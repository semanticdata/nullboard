<h1><img src="extras/favicon-16.png" alt="icon" height="24px" /> Nullboard</h1>

Nullboard is a minimalist take on a kanban board / a task list manager, designed to be compact, readable, and quick in use. The name also happens to abbreviate to [NB](https://en.wikipedia.org/wiki/Nota_bene), which I think is a nice touch.

<p align=left>
<br />
<a href="https://semanticdata.github.io/nullboard/">
<img src="https://img.shields.io/badge/Check%20out%20the%20Demo-F0E68C?style=for-the-badge&link=https%3A%2F%2Fsemanticdata.github.io%2Fnullboard%2F" alt="demo" height="34px"; />
</a>
</p>

## 🖼 Screenshot

<div align=center>

| ![screenshot](images/nullboard-example-alt.png) |
| --- |
</div>

## ✨ Features

### Dead Simple

* Single-page web app - just one HTML file, a jQuery package and, a webfont pack.
* Can be used completely offline. In fact, it's written exactly with this use in mind.

### Locally Stored

* All data is stored locally, for now using [localStorage](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage).
* The data can be exported to- or imported from a plain text file in a simple JSON format.
* The data can also be automatically backed up to a local disk with the help of:
  * [Nullboard Agent](https://nullboard.io/backups) - a native Windows app
  * [Nullboard Agent Express Port](https://github.com/justinpchang/nullboard-agent-express) - an express.js-based portable app
  * [nbagent](https://github.com/luismedel/nbagent) - a version for Unix systems, in Python

### UI & UX

The whole thing is largely about making it convenient to use. Everything is editable in place, all changes are saved automatically and the last 50 revisions are kept for undo/redo:

![In-place editing](images/nullboard-inplace-editing.gif)

New notes can be quickly added directly where they are needed, e.g. before or after existing notes:

![Ctrl-add note](images/nullboard-ctrl-add-note.gif)

Notes can also be dragged around, including to and from other lists:

![Drag-n-drop](images/nullboard-drag-n-drop.gif)

Lists can be moved around as well, though not as flashy as notes:

![List swapping](images/nullboard-list-swap.gif)

Nearly all controls are hidden by default to reduce visual clutter to its minimum:

![Hidden controls](images/nullboard-hidden-controls.gif)

Longer notes can be collapsed to show just the first line, for even more compact view of the board:

![Collapsed notes](images/nullboard-collapsed-notes.gif)

Notes can also be set to look different. This can be used to partitioning lists into sections:

![Raw notes](images/nullboard-raw-notes.gif)

Links starting with `https://` and `http://` are recognized. They will "pulse" on mouse hover and can be opened via the right-click menu.

![Links on hover](images/nullboard-links-on-hover.gif)

Pressing CapsLock will highlight all links and make them left-clickable.

![Links reveal](images/nullboard-links-reveal.gif)

The default font is [Barlow](https://tribby.com/fonts/barlow/) - it's both narrow *and* still very legible. Absolutely fantastic design!

![Barlow speciment](images/barlow-specimen.png)

The font can be changed; its size and line height can be adjusted:

![Theme and zoom](images/nullboard-ui-preferences.gif)

The color theme can be inverted:

![Dark theme](images/nullboard-dark-theme.gif)

Also features:

* Support for multiple boards with near-instant switching.
* Undo/redo for the last 50 revisions per board (configurable in the code).
* Keyboard shortcuts, including Tab'ing through notes.

### Caveats

* Written for desktop and keyboard/mouse use.
* Essentially untested on mobile devices and against tap/touch input.
* Works in Firefox, tested in Chrome, should work in Safari and may work in Edge (or what it's called now).
* Uses localStorage for storing boards/lists/notes, so be careful around [clearing your cache](https://stackoverflow.com/questions/9948284/how-persistent-is-localstorage).

## 🔁 Changelog

The changelog can be found here: 👉 <https://nullboard.io/changes>.

## 🗺 Roadmap - Changes from Upstream

| Change description |       |
| ------------------ | :---: |
| Add new GitHub Actions workflow.         | ✔    |
| Deploy static site with GitHub Pages.    | ✔    |
| Test on Mobile.          | ⏳    |
| Test tab/touch input.    | ⏳    |
| Test on other browsers.  | ⏳    |

## 💜 Attributions

This repository is a fork of [Nullboard](https://github.com/apankrat/nullboard). Thank you [Alexander Pankratov](https://github.com/apankrat) for making it available for others to use.

## © License

Source code in this repository is available under the [2-Clause BSD License](https://opensource.org/licenses/BSD-2-Clause/) and the [Commons Clause](https://commonsclause.com/). This means you can use it, change it, and re-distribute it as long as you don't sell it.
