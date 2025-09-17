import dayjs from 'dayjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const minWeight = levelWeights[envLevel] ?? levelWeights.info;

const formatMessage = (level: LogLevel, message: string) => {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
};

const shouldLog = (level: LogLevel) => levelWeights[level] >= minWeight;

export const logger = {
  debug: (msg: string, meta?: unknown) => {
    if (!shouldLog('debug')) return;
    console.debug(formatMessage('debug', msg), meta ?? '');
  },
  info: (msg: string, meta?: unknown) => {
    if (!shouldLog('info')) return;
    console.info(formatMessage('info', msg), meta ?? '');
  },
  warn: (msg: string, meta?: unknown) => {
    if (!shouldLog('warn')) return;
    console.warn(formatMessage('warn', msg), meta ?? '');
  },
  error: (msg: string, meta?: unknown) => {
    if (!shouldLog('error')) return;
    console.error(formatMessage('error', msg), meta ?? '');
  },
};

export const buildErrorReport = (context: string, error: unknown): string => {
  let errorMessage = '알 수 없는 오류';
  
  if (error instanceof Error) {
    errorMessage = `${error.name}: ${error.message}`;
    if (error.stack) {
      errorMessage += `\n스택 트레이스:\n${error.stack}`;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (typeof error === 'object' && error !== null) {
    // 객체인 경우 더 자세한 정보 추출
    const errorObj = error as Record<string, unknown>;
    if (errorObj.message) {
      errorMessage = String(errorObj.message);
    } else if (errorObj.error) {
      errorMessage = String(errorObj.error);
    } else {
      errorMessage = JSON.stringify(error, null, 2);
    }
  } else {
    errorMessage = String(error);
  }
  
  return `실패 지점: ${context}\n타임스탬프: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n에러: ${errorMessage}`;
};
