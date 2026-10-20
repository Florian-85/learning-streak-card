# learning-streak-card

> One SVG card for your learning streak: experience points, current streak and time spent, from Duolingo today and other services tomorrow. Built by a GitHub Action, no server.

**Status: private incubation.** It is being extracted from the generator that builds my own GitHub profile. Nothing here is published yet.

## What it is

- A single card in the style of the GitHub streak card: a big number on each side, a ring and a flame for the current streak in the middle.
- **Providers** fetch the numbers (Duolingo first; coding, chess and typing platforms are candidates) and the card renders them the same way.
- Four themes (dark, light, funky dark, funky light) and several languages.

## Principles

- **Zero dependency**, runs in a scheduled GitHub Action, and keeps the last known value when a source is down.
- Some sources only offer **unofficial** public endpoints: they are clearly labelled and always optional.
- No password, no cookie: only public profile data, or a token that stays in your own repository secrets.

## Documents

- [Provider candidates, ranking and tested endpoints](docs/providers.md)

## Roadmap

See the issues, starting with the scope of the first release.

## License

To be chosen before the first public release.
