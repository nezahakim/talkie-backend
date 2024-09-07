package metrics

import (
  "net/http"

  "github.com/prometheus/client_golang/prometheus"
  "github.com/prometheus/client_golang/prometheus/promhttp"
)

type PrometheusCollector struct {
  httpRequestsTotal   *prometheus.CounterVec
  httpRequestDuration *prometheus.HistogramVec
  activeConnections   prometheus.Gauge
  activeRooms         prometheus.Gauge
}

func NewPrometheusCollector() *PrometheusCollector {
  pc := &PrometheusCollector{
    httpRequestsTotal: prometheus.NewCounterVec(
      prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total number of HTTP requests",
      },
      []string{"method", "endpoint", "status"},
    ),
    httpRequestDuration: prometheus.NewHistogramVec(
      prometheus.HistogramOpts{
        Name:    "http_request_duration_seconds",
        Help:    "Duration of HTTP requests",
        Buckets: prometheus.DefBuckets,
      },
      []string{"method", "endpoint"},
    ),
    activeConnections: prometheus.NewGauge(
      prometheus.GaugeOpts{
        Name: "active_connections",
        Help: "Number of active WebSocket connections",
      },
    ),
    activeRooms: prometheus.NewGauge(
      prometheus.GaugeOpts{
        Name: "active_rooms",
        Help: "Number of active voice rooms",
      },
    ),
  }

  prometheus.MustRegister(pc.httpRequestsTotal)
  prometheus.MustRegister(pc.httpRequestDuration)
  prometheus.MustRegister(pc.activeConnections)
  prometheus.MustRegister(pc.activeRooms)

  return pc
}

func (pc *PrometheusCollector) IncrementHTTPRequests(method, endpoint string, status int) {
  pc.httpRequestsTotal.WithLabelValues(method, endpoint, string(status)).Inc()
}

func (pc *PrometheusCollector) ObserveHTTPRequestDuration(method, endpoint string, duration float64) {
  pc.httpRequestDuration.WithLabelValues(method, endpoint).Observe(duration)
}

func (pc *PrometheusCollector) SetActiveConnections(count int) {
  pc.activeConnections.Set(float64(count))
}

func (pc *PrometheusCollector) SetActiveRooms(count int) {
  pc.activeRooms.Set(float64(count))
}

func (pc *PrometheusCollector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  promhttp.Handler().ServeHTTP(w, r)
}
