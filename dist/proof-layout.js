// Half-turns need horizontal room for their endpoint labels and vertical room
// for the triangle number and total. Prefer the largest readable arrangement;
// scroll dense results instead of reducing the labels to illegible sizes.
export function proofResultGrid(count, width, height) {
  const gap = 8,
    minWidth = 150,
    minHeight = 116;
  count = Math.max(1, count);
  const maxColumns = Math.min(
    count,
    Math.max(1, Math.floor((width + gap) / (minWidth + gap))),
  );
  let best;
  for (let columns = 1; columns <= maxColumns; columns++) {
    const rows = Math.ceil(count / columns),
      cardWidth = (width - gap * (columns - 1)) / columns,
      rowHeight = Math.max(minHeight, (height - gap * (rows - 1)) / rows),
      overflow = Math.max(0, rows * rowHeight + gap * (rows - 1) - height),
      radius = Math.min((cardWidth - 68) / 2, rowHeight - 72),
      score =
        (overflow < 1 ? 1000 : 0) +
        radius -
        (overflow / Math.max(height, 1)) * 28 -
        (rows * columns - count) * 2;
    if (!best || score > best.score)
      best = { columns, rows, rowHeight, gap, score };
  }
  return best;
}

export function proofResultGeometry(rect) {
  const radius = Math.max(8, Math.min((rect.w - 68) / 2, rect.h - 72)),
    fontSize = Math.max(12, Math.min(18, radius * 0.2));
  return {
    radius,
    fontSize,
    target: { x: rect.x + rect.w / 2, y: rect.y + (rect.h + radius) / 2 + 3 },
    bounds: { x: rect.x + 7, y: rect.y + 27, w: rect.w - 14, h: rect.h - 54 },
  };
}
