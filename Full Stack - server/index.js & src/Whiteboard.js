/*
 * PROJECT: Real-Time Collaborative Whiteboard
 * DESCRIPTION: This project is a real-time, multi-user drawing board that allows users to collaboratively draw using WebSockets. 
 * It includes features such as undo/redo, cursor tracking, and persistent storage using Firebase.
 */

/*
 * BACKEND: WebSocket Server (server/index.js)
 * DESCRIPTION: 
 * - Runs an Express-based WebSocket server for real-time collaboration.
 * - Handles drawing updates and cursor tracking.
 * - Broadcasts changes to all connected clients.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    socket.on("draw", (data) => {
        socket.broadcast.emit("draw", data);
    });

    socket.on("cursor", (data) => {
        socket.broadcast.emit("cursor", data);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
    });
});

server.listen(4000, () => console.log("Server running on port 4000"));


/*
 * FRONTEND: Whiteboard Component (src/Whiteboard.js)
 * DESCRIPTION: 
 * - Provides the UI for the collaborative drawing board.
 * - Uses the Canvas API for drawing functionality.
 * - Listens to WebSocket updates for real-time synchronization.
 * - Saves and loads drawings using Firebase.
 * - Implements undo/redo functionality.
 */

import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { db, collection, addDoc, getDocs } from "../firebase";

const socket = io("http://localhost:4000");

const Whiteboard = () => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [color, setColor] = useState("black");
    const [size, setSize] = useState(5);
    const history = [];
    const redoStack = [];

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth - 50;
        canvas.height = window.innerHeight - 100;
        const ctx = canvas.getContext("2d");
        ctx.lineCap = "round";
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctxRef.current = ctx;

        socket.on("draw", ({ x, y, prevX, prevY, color, size }) => {
            drawLine(prevX, prevY, x, y, color, size);
        });

        socket.on("cursor", ({ x, y }) => {
            drawCursor(x, y);
        });
    }, [color, size]);

    const drawLine = (prevX, prevY, x, y, color, size) => {
        ctxRef.current.strokeStyle = color;
        ctxRef.current.lineWidth = size;
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(prevX, prevY);
        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();
    };

    const startDrawing = ({ nativeEvent }) => {
        setDrawing(true);
    };

    const stopDrawing = () => {
        setDrawing(false);
    };

    const draw = ({ nativeEvent }) => {
        if (!drawing) return;
        const { offsetX: x, offsetY: y } = nativeEvent;
        const { offsetX: prevX, offsetY: prevY } = nativeEvent;
        drawLine(prevX, prevY, x, y, color, size);
        socket.emit("draw", { prevX, prevY, x, y, color, size });
    };

    const saveDrawing = async () => {
        const image = canvasRef.current.toDataURL();
        await addDoc(collection(db, "drawings"), { image });
        alert("Drawing saved successfully!");
    };

    const loadDrawings = async () => {
        const querySnapshot = await getDocs(collection(db, "drawings"));
        querySnapshot.forEach((doc) => {
            const img = new Image();
            img.src = doc.data().image;
            img.onload = () => ctxRef.current.drawImage(img, 0, 0);
        });
    };

    const undo = () => {
        if (history.length > 0) {
            redoStack.push(history.pop());
            restoreCanvas(history[history.length - 1]);
        }
    };

    const redo = () => {
        if (redoStack.length > 0) {
            const image = redoStack.pop();
            history.push(image);
            restoreCanvas(image);
        }
    };

    const restoreCanvas = (imageData) => {
        const img = new Image();
        img.src = imageData;
        img.onload = () => ctxRef.current.drawImage(img, 0, 0);
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px" }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                <input type="range" min="1" max="20" value={size} onChange={(e) => setSize(e.target.value)} />
                <button onClick={undo}>Undo</button>
                <button onClick={redo}>Redo</button>
                <button onClick={saveDrawing}>Save</button>
                <button onClick={loadDrawings}>Load</button>
            </div>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                style={{ border: "2px solid black" }}
            />
        </div>
    );
};

export default Whiteboard;
