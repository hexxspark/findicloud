declare namespace NodeJS {
  interface ProcessEnv {
    RUN_ALL_TESTS?: string;
  }
}

// 扩展平台类型以支持 'mock' 平台
type PlatformWithMock =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'
  | 'mock';
