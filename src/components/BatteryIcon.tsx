interface Props {
  bars: number;
  color: string;
  size?: number;
}

export function BatteryIcon({ bars, color, size = 16 }: Props) {
  const h = size * 0.625;
  const bodyW = size * 0.75;
  const padding = size <= 20 ? 4 : 5;
  const barW = (bodyW - padding) / 3 - 1;
  const barH = h - padding;
  const offset = padding / 2;
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ display: 'block' }}>
      <rect x="0.5" y="0.5" width={bodyW} height={h - 1} rx="1.5" stroke={color} fill="none" strokeWidth="1" />
      <rect x={bodyW + 0.5} y={h * 0.25} width={size - bodyW - 1} height={h * 0.5} rx="0.75" fill={color} opacity="0.5" />
      {[0, 1, 2].map(i => (
        <rect
          key={i}
          x={offset + i * (barW + 1)}
          y={offset}
          width={barW}
          height={barH}
          rx="0.5"
          fill={color}
          opacity={i < bars ? 1 : 0.1}
        />
      ))}
    </svg>
  );
}
