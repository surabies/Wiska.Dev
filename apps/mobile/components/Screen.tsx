// components/Screen.tsx — Pembungkus halaman standar responsif & aman keyboard (UiContract.md)
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAYOUT } from '@/lib/layout';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  safeTop?: boolean;
  contentPadding?: number;
}

export function Screen({
  children,
  scroll = true,
  safeTop = true,
  contentPadding = LAYOUT.screenPadding,
}: ScreenProps) {
  // 1) Inset sistem (status bar, navigation bar, notch)
  const insets = useSafeAreaInsets();

  // 2) Isi dipusatkan dan dibatasi lebarnya agar rapi di tablet/foldable
  const content = (
    <View
      style={{
        width: '100%',
        maxWidth: LAYOUT.maxContentWidth,
        alignSelf: 'center',
        padding: contentPadding,
      }}
    >
      {children}
    </View>
  );

  return (
    // 3) Keyboard tidak menutupi input; safeTop=false bila halaman memakai header native
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        paddingTop: safeTop ? insets.top : 0,
        paddingBottom: insets.bottom,
      }}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}
