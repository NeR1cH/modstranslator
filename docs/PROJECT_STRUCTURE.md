# MOD_TRANSLATOR - Quick Navigation

## 📂 Project Structure

```
modstranslator/
├── README.md              # Main documentation
├── LICENSE                # Apache 2.0
├── package.json           # Dependencies & scripts
│
├── scripts/               # Automation scripts
│   ├── run-tests.bat
│   ├── start-with-tests.bat
│   └── start-with-auto-fix.bat
│
├── docs/                  # Documentation
│   ├── CHANGELOG.md
│   ├── ROADMAP.md
│   ├── SESSION_STATE.md
│   └── reports/
│       ├── TESTING_SCRIPTS.md
│       └── TESTING_SUMMARY.md
│
├── app/                   # Next.js app directory
├── components/            # React components
├── lib/                   # Core logic (parsers, API, cache)
├── __tests__/             # Test files (260 tests)
└── public/                # Static assets
```

## 🚀 Quick Start

```bash
npm install              # Install dependencies
npm run dev              # Start dev server
npm run dev:safe         # Start with tests check
npm test                 # Run tests
```

## 📚 Documentation

- **Main:** [README.md](./README.md)
- **Testing:** [docs/reports/TESTING_SCRIPTS.md](./docs/reports/TESTING_SCRIPTS.md)
- **Roadmap:** [docs/ROADMAP.md](./docs/ROADMAP.md)
- **Changelog:** [docs/CHANGELOG.md](./docs/CHANGELOG.md)

## 🛠️ Scripts

Located in `scripts/` folder:
- `run-tests.bat` - Run tests
- `start-with-tests.bat` - Start with test check
- `start-with-auto-fix.bat` - Start with auto-fix (3 retries)
