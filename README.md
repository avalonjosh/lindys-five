# Buffalo Sabres 2025-26 Season Tracker

A web application that tracks the Buffalo Sabres' performance throughout the 2025-2026 NHL season using a 5-game chunk analysis strategy.

## Features

- **5-Game Chunk Tracking**: Divides the 82-game season into 16 chunks of 5 games plus 1 final chunk of 2 games
- **Color-Coded Performance**: Visual color gradient system to show chunk performance
  - Green shades: 6+ points (meeting or exceeding target)
  - Orange: 5 points (close to target)
  - Red shades: 0-4 points (below target)
- **Season Progress Bar**: Shows current points vs playoff target (96 points)
- **Automatic Updates**: Fetches live data from NHL API and refreshes every 5 minutes
- **Detailed Statistics**: Track W-OTL-L records, points per game, and playoff projections

## The Strategy

The Sabres' coaching staff focuses on 5-game chunks, targeting a minimum of 6 out of 10 points per chunk. This pace (1.2 points/game) projects to approximately 98 points over 82 games, which is typically enough for playoff contention in the NHL.

## Technology Stack

- React 18 + TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- NHL Official API for real-time data
- Vercel for deployment

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment

This app is configured for easy deployment on Vercel:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts to deploy

Alternatively, connect your GitHub repository to Vercel for automatic deployments on every push.

## Data Source

Game data is fetched from the official NHL API (`https://api-web.nhle.com/v1/`), which provides:
- Complete season schedule
- Live game scores
- Game outcomes (regulation, overtime, or shootout)

## Color Guide

- **Bright Green**: 10 points (perfect chunk)
- **Medium Green**: 8-9 points (excellent)
- **Light Green**: 6-7 points (target met!)
- **Orange**: 5 points (close to target)
- **Light Red**: 3-4 points (below target)
- **Dark Red**: 0-2 points (poor performance)

## License

MIT

## Acknowledgments

- Data provided by NHL.com
- Inspired by the Buffalo Sabres coaching staff's 5-game chunk strategy
