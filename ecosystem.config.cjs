// PM2 process file — the ONE managed instance of the MUSE demo server.
//
// Why: during the hackathon the server was run by hand from two shells and kept dying or
// coming back up from the WRONG checkout (server.mjs serves process.cwd()); pm2 pins the
// cwd to this file's directory and auto-restarts on crash. Single consolidated port: 4174
// (every acceptance pass was verified against it).
//
//   pm2 start ecosystem.config.cjs   — start (or `pm2 restart muse-infinity`)
//   pm2 logs muse-infinity           — tail server output
//   pm2 save                         — persist across pm2 daemon restarts
module.exports = {
  apps: [
    {
      name: "muse-infinity",
      script: "server.mjs",
      cwd: __dirname, // serve THIS checkout no matter where pm2 is invoked from
      node_args: "--env-file=.env", // secrets stay in the untracked .env
      env: { PORT: "4174" },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 50,
      watch: false, // static server reads from disk per-request; no restart needed on edits
    },
  ],
};
