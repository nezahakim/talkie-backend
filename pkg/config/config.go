package config

import (
  "time"

  "github.com/spf13/viper"
)

type Config struct {
  Server   ServerConfig
  Database DatabaseConfig
  Redis    RedisConfig
  Auth     AuthConfig
  Logging  LoggingConfig
  Metrics  MetricsConfig
}

type ServerConfig struct {
  Port         int
  ReadTimeout  time.Duration
  WriteTimeout time.Duration
  IdleTimeout  time.Duration
}

type DatabaseConfig struct {
  Host         string
  Port         int
  User         string
  Password     string
  DBName       string
  MaxOpenConns int
  MaxIdleConns int
  MaxLifetime  time.Duration
}

type RedisConfig struct {
  Addr     string
  Password string
  DB       int
}

type AuthConfig struct {
  JWTSecret        string
  JWTExpirationHrs int
}

type LoggingConfig struct {
  Level string
  File  string
}

type MetricsConfig struct {
  Enabled bool
  Port    int
}

func LoadConfig() (*Config, error) {
  viper.SetConfigName("config")
  viper.SetConfigType("yaml")
  viper.AddConfigPath(".")
  viper.AddConfigPath("./configs")
  viper.AutomaticEnv()

  if err := viper.ReadInConfig(); err != nil {
    return nil, err
  }

  var config Config
  if err := viper.Unmarshal(&config); err != nil {
    return nil, err
  }

  return &config, nil
}
