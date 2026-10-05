# EV Guardian AI — Frontend

A browser-based battery monitoring dashboard built with plain HTML, CSS, and JavaScript. The interface currently uses sample telemetry so it can be opened and edited without installing a framework or dependencies.

## Project files

```text
BMS_AI_project/
├── README.md
├── .gitignore
└── frontend2/
    ├── index.html   # Page structure and font/style links
    ├── styles.css   # Layout, colors, responsive rules, and chart tooltip
    └── app.js       # Sample telemetry, navigation, dashboard views, and chart
```

## Run the website

The quickest option is to open `frontend2/index.html` in a web browser. The dashboard does not require Node.js, npm, a build step, or a backend.

For a local web server, open a terminal in this project folder and run:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/frontend2/>. Stop the server with `Ctrl+C`.

## Customize it

- Change sample battery values and alert data in `frontend2/app.js`, in the `telemetry` object.
- Update chart history in the `observed`, `predicted`, and `labels` arrays in `frontend2/app.js`.
- Edit the appearance and responsive layout in `frontend2/styles.css`.
- Edit page metadata and the sidebar structure in `frontend2/index.html`.

The dashboard includes Dashboard, Battery health, Thermal analysis, Alerts, and Device & system views. The chart displays observed and projected sample temperatures, with values shown when hovering over the graph.

## Notes

- The displayed readings and device state are mock data for the interface preview. They are not connected to a battery controller.
- Google Fonts are loaded from the internet. If the connection is unavailable, the browser falls back to system fonts.
