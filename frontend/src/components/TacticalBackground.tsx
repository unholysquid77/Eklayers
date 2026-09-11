'use client';

import React, { useEffect, useRef } from 'react';

export default function TacticalBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Subtle drifting geometric nodes
    const NODE_COUNT = 20;
    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      size: Math.random() * 2 + 1.5,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.003,
      shape: Math.random() > 0.5 ? 'diamond' : 'ring',
    }));

    let sweepY = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Faint Tactical Grid Matrix
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.015)';
      ctx.lineWidth = 1;
      const gridSize = 64;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Slow Radar Scanline Sweep
      sweepY = (sweepY + 0.35) % (height + 200);
      const sweepGrad = ctx.createLinearGradient(0, sweepY - 120, 0, sweepY);
      sweepGrad.addColorStop(0, 'rgba(0, 255, 136, 0)');
      sweepGrad.addColorStop(1, 'rgba(0, 255, 136, 0.022)');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, sweepY - 120, width, 120);

      // 3. Subtle Drifting Wireframe Nodes & Links
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.rot += n.rotSpeed;

        if (n.x < -40) n.x = width + 40;
        if (n.x > width + 40) n.x = -40;
        if (n.y < -40) n.y = height + 40;
        if (n.y > height + 40) n.y = -40;

        // Draw connections between nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 180 * 180) {
            const alpha = (1 - Math.sqrt(distSq) / 180) * 0.035;
            ctx.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        // Draw subtle node shape
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.rot);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.04)';
        ctx.lineWidth = 1;

        if (n.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -n.size * 3);
          ctx.lineTo(n.size * 3, 0);
          ctx.lineTo(0, n.size * 3);
          ctx.lineTo(-n.size * 3, 0);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, n.size * 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-80"
    />
  );
}
