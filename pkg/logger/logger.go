package logger

import (
  "os"

  "go.uber.org/zap"
  "go.uber.org/zap/zapcore"
  "gopkg.in/natefinch/lumberjack.v2"
)

type Logger struct {
  *zap.SugaredLogger
}

func NewLogger(cfg *config.LoggingConfig) (*Logger, error) {
  logLevel, err := zapcore.ParseLevel(cfg.Level)
  if err != nil {
    return nil, err
  }

  encoderConfig := zap.NewProductionEncoderConfig()
  encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

  fileEncoder := zapcore.NewJSONEncoder(encoderConfig)
  consoleEncoder := zapcore.NewConsoleEncoder(encoderConfig)

  fileSyncer := zapcore.AddSync(&lumberjack.Logger{
    Filename:   cfg.File,
    MaxSize:    100, // megabytes
    MaxBackups: 3,
    MaxAge:     28, // days
  })

  core := zapcore.NewTee(
    zapcore.NewCore(fileEncoder, fileSyncer, logLevel),
    zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), logLevel),
  )

  logger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))

  return &Logger{logger.Sugar()}, nil
}

func (l *Logger) Sync() error {
  return l.SugaredLogger.Sync()
}
