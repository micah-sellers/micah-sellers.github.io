# Copilot Instructions for micah-sellers.github.io

## Project Overview
This is a personal portfolio website published via GitHub Pages. The project is a static site with minimal dependencies—pure HTML, CSS, and JavaScript. The site serves as a professional hub to showcase Micah Sellers' work, experience, and contact information.

## Architecture

### File Structure
- **index.html** — Main entry point; currently sparse (minimal body content)
- **index.js** — JavaScript module for interactivity; currently empty
- **style.css** — Stylesheet for visual presentation; currently empty

### Design Approach
This is a **single-page application (SPA)** using vanilla HTML/CSS/JS with no build tools, frameworks, or package managers. All code runs in the browser directly.

## Key Patterns & Conventions

### HTML Structure
- Use semantic HTML5 elements (header, nav, section, footer)
- Include viewport meta tag for responsive design (already present)
- Keep HTML semantic and accessible; avoid divitis

### CSS Styling
- Use CSS Grid or Flexbox for layouts (modern, no legacy browser support needed)
- Organize selectors logically (typography → layout → components)
- Prefer CSS custom properties (variables) for consistent theming

### JavaScript Conventions
- Keep functions concise and focused
- Use modern ES6+ syntax (arrow functions, const/let, template literals)
- Minimize global scope pollution; prefer module-like IIFE or class patterns if complexity grows
- No external dependencies—write vanilla JS solutions

## Development Workflow

### Local Testing
1. Open `index.html` directly in a browser, or
2. Serve via a local HTTP server: `python -m http.server 8000` (or similar)
3. Use browser DevTools (F12) to debug and inspect live CSS/JS

### Publishing
- Push changes to the main branch on GitHub
- Site auto-publishes via GitHub Pages (typically within 1-5 minutes)
- Verify at `https://micah-sellers.github.io` or your configured custom domain

### No Build Step
There is no build process, bundler, or transpiler. All changes are live immediately; avoid introducing tools that complicate the workflow.

## Content Guidelines

### Portfolio Sections (Expected)
- **Header/Hero** — Name, tagline, professional photo
- **About** — Brief background and expertise
- **Projects/Work** — Showcased portfolio items with links
- **Skills** — Languages, tools, domains
- **Contact** — Email, GitHub, LinkedIn, or contact form

### Media & Performance
- Use optimized images (WebP preferred, fallback to JPEG/PNG)
- Keep CSS/JS lean; defer non-critical scripts
- Consider lazy-loading for images and sections if page grows

## Integration Points

### External Resources
- GitHub Pages serves the site; no custom backend required
- Links to external portfolios, GitHub profiles, LinkedIn, etc. are expected

### Contact Methods
- Email link (`mailto:`) 
- Social links (GitHub, LinkedIn) with appropriate icons/metadata
- Optional: Contact form would require a third-party service (Formspree, Netlify, etc.)

## Common Tasks

### Adding a New Project
1. Create a new `<section>` with project details in `index.html`
2. Add corresponding styles in `style.css` (e.g., `.project-card`)
3. Use semantic markup with images, descriptions, and links

### Updating Styles
1. Edit `style.css` directly; no scoping or preprocessing
2. Use CSS custom properties for colors, spacing, fonts
3. Test responsiveness in DevTools (mobile, tablet, desktop)

### Adding Interactivity
1. Write vanilla JS in `index.js`
2. Target elements using `document.querySelector()` or `getElementById()`
3. Attach event listeners for clicks, scrolls, form submissions
4. Keep logic simple; avoid overcomplicating a static site

## Notes for AI Agents

- **Minimize Scope** — This is a personal brand site; avoid feature creep
- **Accessibility First** — Ensure semantic HTML, proper contrast, keyboard navigation
- **Mobile-First** — Design for mobile; enhance for larger screens
- **No Dependencies** — Propose vanilla solutions only; avoid npm packages
- **Performance** — Keep JS and CSS under control; a portfolio site should load fast
- **Keep It Simple** — Complexity is the enemy of a portfolio site; clarity and professionalism matter most
