export interface JanitorOptions {
  pollInterval?: number       // ms between scans, default 10000
  visibilityTimeout?: number  // seconds before job considered stuck, default 60
}