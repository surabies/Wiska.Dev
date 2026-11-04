/**
 * api-client.ts — klien API terpusat. Padanan `core/network/api_client.dart`
 * (Dio → `fetch` bawaan React Native).
 *
 * Satu-satunya tempat envelope backend dibongkar. Kontrak envelope
 * (berlaku untuk SEMUA endpoint):
 *   sukses : { "success": true,  "data": ..., "meta"?: {...} }
 *   gagal  : { "success": false, "error": { "code", "message", "details"? } }
 *
 * Seperti Dio dengan `validateStatus: () => true`, status error TIDAK
 * dilempar oleh transport — envelope { error } tetap dibaca dan diubah jadi
 * ApiException di `unwrap`, bukan di lapisan HTTP.
 */
import { ApiConfig } from './api-config';
import { ApiException, fieldErrorFromJson, type FieldError } from './api-exception';

const CONNECT_TIMEOUT_MS = 15000;
const RECEIVE_TIMEOUT_MS = 30000;

/** Nilai query yang boleh dikirim; entri null/undefined dibuang otomatis. */
export type QueryValue = string | number | boolean | null | undefined;

/** Hasil endpoint list — selalu berpaginasi di backend. */
export interface Paged<T> {
  rows: T[];
  meta: PageMeta;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function pageMetaFromJson(json: unknown): PageMeta {
  if (json == null || typeof json !== 'object') {
    return { page: 1, pageSize: 0, total: 0, totalPages: 1 };
  }
  const raw = json as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' ? Math.trunc(v) : fallback;
  return {
    page: num(raw['page'], 1),
    pageSize: num(raw['pageSize'], 20),
    total: num(raw['total'], 0),
    totalPages: num(raw['totalPages'], 1),
  };
}

interface SendOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Multipart form-data (foto bukti dsb.); mengabaikan `body`. */
  form?: FormData;
}

class ApiClientImpl {
  private accessToken: string | null = null;

  /**
   * Dipanggil sekali setiap kali endpoint /api/v1 menjawab 401 SAAT token
   * terpasang (kedaluwarsa/dicabut). TIDAK terpicu oleh 401 dari endpoint
   * login sendiri (kredensial salah bukan sesi berakhir).
   */
  onUnauthorized: (() => void) | null = null;

  /**
   * Pasang token Bearer hasil POST /api/mobile/auth/login|google.
   * Token berumur 7 hari, tanpa refresh — saat 401, hapus dan login ulang.
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  get<T>(
    path: string,
    opts: { query?: Record<string, QueryValue>; parse: (data: unknown) => T },
  ): Promise<T> {
    return this.send(path, { method: 'GET', query: opts.query }).then((r) =>
      this.unwrap(r, opts.parse),
    );
  }

  async getList<T>(
    path: string,
    opts: {
      query?: Record<string, QueryValue>;
      parseRow: (row: Record<string, unknown>) => T;
    },
  ): Promise<Paged<T>> {
    const r = await this.send(path, { method: 'GET', query: opts.query });
    const body = this.bodySukses(r);
    const data = body['data'];
    const rows = Array.isArray(data)
      ? data
          .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
          .map(opts.parseRow)
      : [];
    return { rows, meta: pageMetaFromJson(body['meta']) };
  }

  post<T>(
    path: string,
    opts: { body?: unknown; parse: (data: unknown) => T },
  ): Promise<T> {
    return this.send(path, { method: 'POST', body: opts.body }).then((r) =>
      this.unwrap(r, opts.parse),
    );
  }

  patch<T>(
    path: string,
    opts: { body?: unknown; parse: (data: unknown) => T },
  ): Promise<T> {
    return this.send(path, { method: 'PATCH', body: opts.body }).then((r) =>
      this.unwrap(r, opts.parse),
    );
  }

  delete<T>(
    path: string,
    opts: { body?: unknown; parse: (data: unknown) => T },
  ): Promise<T> {
    return this.send(path, { method: 'DELETE', body: opts.body }).then((r) =>
      this.unwrap(r, opts.parse),
    );
  }

  /**
   * Kirim multipart/form-data (foto bukti dsb.). Server memvalidasi berkas
   * lewat magic bytes dan memilih sendiri nama/ekstensinya — jangan set
   * header Content-Type manual, `fetch` menambah boundary sendiri.
   */
  postMultipart<T>(
    path: string,
    opts: { form: FormData; parse: (data: unknown) => T },
  ): Promise<T> {
    return this.send(path, { method: 'POST', form: opts.form }).then((r) =>
      this.unwrap(r, opts.parse),
    );
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async send(path: string, opts: SendOptions): Promise<HttpResult> {
    const url = ApiConfig.baseUrl + path + buildQuery(opts.query);

    const headers: Record<string, string> = {};
    if (this.accessToken != null) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let payload: BodyInit | undefined;
    if (opts.form != null) {
      payload = opts.form; // fetch menyusun boundary + Content-Type sendiri.
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }

    // connectTimeout + receiveTimeout Dio digabung jadi satu batas keseluruhan
    // — `fetch` RN tidak memisah keduanya.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      CONNECT_TIMEOUT_MS + RECEIVE_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: opts.method,
        headers,
        body: payload,
        signal: controller.signal,
      });
      const data = await bacaJson(response);
      return { status: response.status, path, data };
    } catch (err) {
      // DULU: semua exception di sini jadi NETWORK_ERROR. Itu menyembunyikan
      // sebab yang sama sekali bukan jaringan — berkas bukti yang sudah
      // dihapus OS, FormData yang ditolak modul native — di balik alert
      // "sambungan terputus", yang lalu menyuruh petugas "coba lagi begitu
      // ada sinyal" untuk kegagalan yang tidak akan pernah sembuh sendiri.
      //
      // React Native melempar `TypeError: Network request failed` untuk
      // kegagalan transport sungguhan dan `AbortError` saat batas waktu
      // tercapai. Hanya keduanya yang berhak disebut offline (status 0) —
      // itu yang dibaca `offline()` di repository untuk memutuskan
      // menghentikan sinkronisasi.
      const sebab = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      const abort = err instanceof Error && err.name === 'AbortError';
      // Daftar ini SENGAJA panjang. Android melempar nama pengecualian Java
      // mentah lewat fetch — "java.net.ConnectException", "UnknownHostException",
      // "SocketTimeoutException" — dan tidak satu pun mengandung kata
      // "network". Versi pertama hanya mencocokkan /network|timeout|connection/,
      // sehingga ConnectException (perhatikan: "Connect", bukan "connection")
      // lolos dan diperlakukan sebagai galat klien. Itu bukan cuma pesan yang
      // keliru: status -1 membuat `offline()` bernilai false, jadi antrean
      // menganggap sinyal putus sebagai kegagalan permanen alih-alih menunggu.
      // Terlihat di perangkat saat server lokal sengaja diputus.
      const polaJaringan =
        /network|timeout|connect|socket|unreachable|unresolved|host|refused|closed|fetch failed|ssl|tls|certificate|ECONN|EHOST|ENET/i;
      const jaringan = abort || err instanceof TypeError || polaJaringan.test(sebab);

      if (jaringan) {
        throw new ApiException(
          0,
          'NETWORK_ERROR',
          abort
            ? 'Server tidak menjawab tepat waktu. Coba lagi begitu sinyal membaik.'
            : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
          undefined,
          sebab,
        );
      }

      // Bukan jaringan: sampaikan apa adanya. Sebabnya ikut di pesan karena
      // inilah satu-satunya jalan galat ini terlihat dari lapangan.
      throw new ApiException(
        -1,
        'CLIENT_ERROR',
        `Permintaan gagal disiapkan di perangkat — ${sebab}`,
        undefined,
        sebab,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private bodySukses(r: HttpResult): Record<string, unknown> {
    const body = r.data;
    if (body != null && typeof body === 'object' && (body as Record<string, unknown>)['success'] === true) {
      return body as Record<string, unknown>;
    }
    throw this.sebagaiError(r);
  }

  private unwrap<T>(r: HttpResult, parse: (data: unknown) => T): T {
    return parse(this.bodySukses(r)['data']);
  }

  private sebagaiError(r: HttpResult): ApiException {
    if (
      r.status === 401 &&
      this.accessToken != null &&
      r.path.startsWith(ApiConfig.v1Path)
    ) {
      this.onUnauthorized?.();
    }
    const body = r.data;
    const error =
      body != null && typeof body === 'object'
        ? (body as Record<string, unknown>)['error']
        : null;
    if (error != null && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      const rawDetails = e['details'];
      const details: FieldError[] | undefined = Array.isArray(rawDetails)
        ? rawDetails.map(fieldErrorFromJson).filter((x): x is FieldError => x != null)
        : undefined;
      return new ApiException(
        r.status,
        (e['code'] as string) ?? 'UNKNOWN',
        (e['message'] as string) ?? 'Terjadi kesalahan.',
        details,
      );
    }
    return new ApiException(
      r.status,
      'UNKNOWN',
      `Terjadi kesalahan pada server (${r.status}).`,
    );
  }
}

interface HttpResult {
  status: number;
  path: string;
  data: unknown;
}

/** Baca body sebagai JSON; kembalikan null bila kosong/bukan JSON. */
async function bacaJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Rakit query string, buang entri null/undefined supaya bersih (?status=&q=
 * membingungkan validator backend). Mengembalikan '' bila tak ada entri.
 */
function buildQuery(query?: Record<string, QueryValue>): string {
  if (query == null) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null) params.append(key, String(value));
  }
  const s = params.toString();
  return s.length > 0 ? `?${s}` : '';
}

/** Singleton — padanan `ApiClient.instance` di Dart. */
export const ApiClient = new ApiClientImpl();
export type ApiClient = ApiClientImpl;
