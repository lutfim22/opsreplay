# IoT integration

Step 9 ships a deterministic **simulator** only. No real hardware is connected.

## Architecture
- `lib/events/schema.ts` – Zod `OpsEvent` schema. `source` carries `provider`, `name` and `simulated`.
- `lib/events/source.ts` – `EventSource<TRaw>` interface and `normalizeAll`, which validates every event and that it matches its source identity.
- `lib/events/engine.ts` – pure `ingestEvents` (ordering by timestamp then id, duplicate-id rejection).
- `lib/events/anomaly.ts` – deterministic rules (power spike, offline, recovery).
- `lib/simulator/virtual-plug.ts` – scripted virtual plug (`SIMULATED`).
- The UI owns timers; the event engine has no React or timer dependency.

## Future Shelly Plug PM Gen3 adapter
Implement `EventSource<ShellyRaw>` with `ref = { provider: "shelly", name: <device name>, simulated: false }`:

| Shelly telemetry | OpsEvent |
| --- | --- |
| `switch:0` `apower` (W) | `type: "power.reading"`, `metrics.powerW` |
| `switch:0` `voltage` / `current` | `metrics.voltageV` / `metrics.currentA` |
| `aenergy.total` (Wh) | `metrics.energyWh` |
| WebSocket/MQTT connect / disconnect | `device.online` / `device.offline` |
| device id (e.g. `shellyplugpmg3-…`) | `deviceId` |
| `ts` / `aenergy.minute_ts` (epoch s) | `timestamp` (ISO 8601 UTC) |
| full notification | `payload` |

Event ids must be stable and unique (e.g. `shelly:<deviceId>:<ts>:<method>`) so duplicates from reconnects are dropped.

## Not implemented
- Network transport (Shelly RPC over WebSocket/HTTP, MQTT) and device discovery.
- Credentials/auth, secrets handling, and persistence (state is browser-local).
- Reconnect/backfill logic, clock-skew handling and rate limiting.
- Linking GitHub events to incidents (the GitHub provider itself is implemented in `lib/github`).
- AI-assisted anomaly detection (current rules are static thresholds).
