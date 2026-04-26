# Igisoro Royale - Premium Multiplayer

A modern, high-fidelity digital implementation of the traditional Rwandan board game **Igisoro**. Built with a focus on premium aesthetics, smooth animations, and real-time multiplayer capabilities.

## 🌟 Features
- **Realistic Skeuomorphism**: A tactile, analog-inspired design featuring a deep mahogany wooden board, carved pits, and organic 3D seeds.
- **Organic Physics**: Seeds are distributed in a natural spiral pattern to mimic real-world piles.
- **Intelligent Bot Mode**: Play against a greedy AI that masterfully uses captures and relays.
- **Real-time Multiplayer**: Play with anyone using a simple room code.
- **Official Rules**: Implements the full ruleset including continuous moves (relay sowing), captures, and direction changes.

## 🕹️ How to Play
1. **Setup**: The board has 4 rows of 8 pits. Each player controls the two rows closest to them.
2. **Start**: Choose a pit with at least 2 seeds in your territory.
3. **Sow**: Seeds are sown one-by-one counter-clockwise.
4. **Relay**: If your last seed lands in a non-empty pit, pick up all seeds from that pit and continue sowing.
5. **Capture**: If your last seed lands in a non-empty pit AND both pits directly opposite (opponent's territory) have seeds, you can capture them!
    - **Capture Effect**: Captured seeds are added to your hand, and you restart sowing from your original starting pit.
    - **Direct Capture**: If you capture on the very first step of your turn, you can choose to sow clockwise!
6. **Win**: You win when your opponent has no legal moves (all their pits are empty or have only 1 seed).

## 🚀 Running Locally

### Prerequisites
- Node.js (v16 or higher)
- npm

### 1. Start the Server
```bash
cd server
npm install
node index.js
```

### 2. Start the Client
```bash
cd client
npm install
npm run dev
```

Open your browser to the URL provided by Vite (usually `http://localhost:5173`). Open two tabs to play against yourself!

## 🛠️ Technology Stack
- **Frontend**: Vite, Vanilla JavaScript, CSS3.
- **Backend**: Node.js, Express, Socket.io.
- **Styling**: Vanilla CSS with custom design tokens.

## 📜 License
MIT
