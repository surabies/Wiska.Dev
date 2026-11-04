/**
 * with-rilis-android.js — konfigurasi build rilis Android yang BERTAHAN.
 *
 * KENAPA PLUGIN, BUKAN MENGUBAH android/ LANGSUNG. Folder `android/` diabaikan
 * git (lihat .gitignore) karena ia hasil `expo prebuild`. Menyetel arsitektur
 * dan penandatanganan di sana berarti keduanya HILANG pada prebuild
 * berikutnya — dan yang berbahaya bukan hilangnya, melainkan diamnya: APK
 * berikutnya kembali memakai debug key dan empat arsitektur tanpa satu pun
 * peringatan, lalu dibagikan.
 *
 * Plugin ini ikut ter-commit, jadi siapa pun yang clone repo lalu prebuild
 * mendapat hasil yang sama.
 *
 * TIGA HAL YANG DIATUR:
 *
 *   1. arm64-v8a SAJA. Empat arsitektur membuat APK ~135 MB padahal tiga di
 *      antaranya tidak akan pernah dipakai: armeabi-v7a hanya untuk perangkat
 *      32-bit yang sudah langka, dan x86/x86_64 praktis cuma emulator.
 *
 *   2. Penandatanganan rilis dari keystore produksi. Kredensialnya TIDAK ada
 *      di sini maupun di repo — ia dibaca dari properti Gradle yang disimpan
 *      di ~/.gradle/gradle.properties, di luar proyek. Bila propertinya tidak
 *      ada, build rilis SENGAJA GAGAL alih-alih diam-diam memakai debug key.
 *
 *   3. Build debug BERDAMPINGAN dengan yang rilis, lewat akhiran paket
 *      `.debug`. Tanpa ini keduanya memakai applicationId yang sama, dan
 *      karena tanda tangannya berbeda (debug key vs keystore produksi)
 *      Android MENOLAK memasang yang satu di atas yang lain — memasang build
 *      dev berarti meng-uninstall app produksi lebih dulu, dan ikut membuang
 *      rute yang sudah diunduh serta pencatatan yang belum terkirim.
 */
const path = require('path');
const fs = require('fs');
const {
  withGradleProperties,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');

/** Nama properti Gradle yang menyimpan kredensial keystore. */
const PROP = {
  berkas: 'TIRTAWENING_STORE_FILE',
  sandiStore: 'TIRTAWENING_STORE_PASSWORD',
  alias: 'TIRTAWENING_KEY_ALIAS',
  sandiKunci: 'TIRTAWENING_KEY_PASSWORD',
};

const BLOK_SIGNING = `        release {
            // Kredensial datang dari ~/.gradle/gradle.properties — DI LUAR
            // repo. Tanpa itu build rilis gagal dengan pesan yang menyebut
            // apa yang kurang, bukan diam-diam jatuh ke debug key.
            if (!project.hasProperty('${PROP.berkas}')) {
                throw new GradleException(
                    "Build rilis butuh kredensial keystore. Tambahkan ${PROP.berkas}, " +
                    "${PROP.sandiStore}, ${PROP.alias}, dan ${PROP.sandiKunci} " +
                    "ke ~/.gradle/gradle.properties. Lihat plugins/with-rilis-android.js."
                )
            }
            storeFile file(project.property('${PROP.berkas}'))
            storePassword project.property('${PROP.sandiStore}')
            keyAlias project.property('${PROP.alias}')
            keyPassword project.property('${PROP.sandiKunci}')
        }
`;

function withArsitekturArm64(config) {
  return withGradleProperties(config, (cfg) => {
    const kunci = 'reactNativeArchitectures';
    const nilai = 'arm64-v8a';
    const ada = cfg.modResults.find((p) => p.type === 'property' && p.key === kunci);
    if (ada) ada.value = nilai;
    else cfg.modResults.push({ type: 'property', key: kunci, value: nilai });
    return cfg;
  });
}

function withPenandatangananRilis(config) {
  return withAppBuildGradle(config, (cfg) => {
    let isi = cfg.modResults.contents;

    // 1) Sisipkan signingConfigs.release tepat setelah blok debug.
    if (!isi.includes('signingConfigs.release')) {
      const penanda = /(signingConfigs \{[\s\S]*?debug \{[\s\S]*?\}\n)/;
      if (!penanda.test(isi)) {
        throw new Error(
          '[with-rilis-android] Blok signingConfigs.debug tidak ditemukan — ' +
            'template prebuild berubah, plugin perlu disesuaikan.',
        );
      }
      isi = isi.replace(penanda, `$1${BLOK_SIGNING}`);
    }

    // 2) buildTypes.release menunjuk ke signingConfigs.release, bukan debug.
    //    Penggantiannya DIBATASI pada blok release: `signingConfig
    //    signingConfigs.debug` juga muncul di buildTypes.debug, dan menimpa
    //    keduanya akan membuat build debug menuntut keystore produksi.
    isi = isi.replace(
      /(buildTypes \{[\s\S]*?release \{\n(?:[^\n]*\n)*?\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );

    cfg.modResults.contents = isi;
    return cfg;
  });
}

/** Akhiran applicationId untuk build debug, dan nama app yang menyertainya. */
const AKHIRAN_DEBUG = '.debug';
const NAMA_APP_DEBUG = 'Petugas DEV';

/**
 * applicationId build debug diberi akhiran `.debug` supaya ia app yang
 * BERBEDA di mata Android: dua ikon, dua penyimpanan lokal, dan build dev
 * tidak pernah menimpa app produksi yang sedang dipakai petugas.
 */
function withPaketDebugTerpisah(config) {
  return withAppBuildGradle(config, (cfg) => {
    let isi = cfg.modResults.contents;
    if (isi.includes(`applicationIdSuffix '${AKHIRAN_DEBUG}'`)) return cfg;

    // Jangkarnya `buildTypes {` lebih dulu — `debug {` sendirian juga cocok
    // dengan blok di dalam signingConfigs, dan menyisipkan applicationIdSuffix
    // di sana bukan cuma salah tempat, tapi tidak sah sebagai Gradle.
    const penanda = /(buildTypes \{\n\s*debug \{\n)/;
    if (!penanda.test(isi)) {
      throw new Error(
        '[with-rilis-android] Blok buildTypes.debug tidak ditemukan — ' +
          'template prebuild berubah, plugin perlu disesuaikan.',
      );
    }
    isi = isi.replace(penanda, `$1            applicationIdSuffix '${AKHIRAN_DEBUG}'\n`);

    cfg.modResults.contents = isi;
    return cfg;
  });
}

/**
 * Nama app build debug dibedakan lewat strings.xml di source set `debug`.
 * Bukan `resValue` di buildTypes: `app_name` sudah ada di source set utama,
 * dan mendeklarasikannya lagi lewat resValue membuat merger resource gagal
 * karena duplikat. Source set justru dirancang untuk menimpa.
 *
 * Tanpa ini kedua ikon bernama sama persis, dan satu-satunya cara membedakan
 * mana yang dev adalah membukanya — persis saat perbedaan itu paling penting.
 */
function withNamaAppDebug(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'debug',
        'res',
        'values',
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n` +
          `<!-- Dihasilkan plugins/with-rilis-android.js — jangan disunting langsung. -->\n` +
          `<resources>\n` +
          `  <string name="app_name">${NAMA_APP_DEBUG}</string>\n` +
          `</resources>\n`,
      );
      return cfg;
    },
  ]);
}

module.exports = function withRilisAndroid(config) {
  return withNamaAppDebug(
    withPaketDebugTerpisah(withPenandatangananRilis(withArsitekturArm64(config))),
  );
};
