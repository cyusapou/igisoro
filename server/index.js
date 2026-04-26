const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', () => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms.set(roomCode, {
            players: [{ id: socket.id, name: 'Player 1', side: 0 }],
            gameState: null
        });
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, side: 0 });
        console.log(`Room created: ${roomCode}`);
    });

    socket.on('join_room', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room) {
            if (room.players.length < 2) {
                room.players.push({ id: socket.id, name: 'Player 2', side: 1 });
                socket.join(roomCode);
                socket.emit('room_joined', { roomCode, side: 1 });
                io.to(roomCode).emit('player_joined', { players: room.players });
                console.log(`User ${socket.id} joined room ${roomCode}`);
            } else {
                socket.emit('error', 'Room is full');
            }
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    socket.on('game_move', ({ roomCode, moveData }) => {
        // Broadcast the move to the other player in the room
        socket.to(roomCode).emit('game_move', moveData);
    });

    socket.on('chat_message', ({ roomCode, message }) => {
        socket.to(roomCode).emit('chat_message', message);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle room cleanup if necessary
        for (const [code, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else {
                    io.to(code).emit('player_left', { players: room.players });
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
