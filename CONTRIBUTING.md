# Contributing to CArrY

First off — thanks for being here. CArrY is built for developers who don't have unlimited budgets, and every contribution makes it better for that community.

---

## The Easiest Way to Contribute: Add a Project Pattern

The pattern library is what makes CArrY smart. The more project types it knows, the better it labels codebases.

A pattern lives in `pattern-library.json` and looks like this:

```json
"blog-platform": {
  "common_folders": ["posts", "authors", "tags", "comments", "admin"],
  "common_files": ["Post.jsx", "Editor.jsx", "Slug.js", "rss.js"],
  "common_dependencies": ["gray-matter", "marked", "rss", "slug"],
  "keywords": ["post", "author", "slug", "publish", "draft", "markdown"]
}
```

To add a new project type:

1. Fork the repo
2. Find 10+ open source repos of that type on GitHub
3. Note what folders, files, dependencies, and keywords appear most often
4. Add your pattern to `pattern-library.json`
5. Open a pull request with a short description of the project type and which repos you referenced

That's it.

---

## Reporting Bugs

If CArrY misidentified your project or produced a bad handoff prompt, open an issue with:

- What type of project you were running it on
- What CArrY said vs what you expected
- Your Node.js version (`node --version`)

---

## Suggesting Features

Open an issue tagged `enhancement`. Be specific about the problem you're solving — not just the feature you want.

---

## Code Contributions

1. Fork and clone the repo
2. Run `npm install`
3. Make your changes in a new branch
4. Test against a few different project types
5. Open a pull request

Keep changes focused. One thing per PR.

---

## Code of Conduct

Be decent. That's it.
