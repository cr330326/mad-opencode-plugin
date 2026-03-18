# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-03-18

### Fixed
- Auto-create `~/.opencode/log/` directory if it doesn't exist when writing log file

## [0.1.0] - 2026-03-18

### Added
- Initial release
- Event hooks: `event`, `chat.message`, `tool.execute.after`
- Data sync to MAD Server via HTTP API
- Heartbeat mechanism (30s interval) with memory and uptime stats
- Offline queue with exponential backoff retry
- File-based logging to `~/.opencode/log/mad-plugin.log`
- Configurable via environment variables (MAD_SERVER_URL, MAD_API_KEY, MAD_CLIENT_NAME)
- TypeScript type definitions included
