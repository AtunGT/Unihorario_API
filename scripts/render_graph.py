import sys
import json
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

def main():
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: render_graph.py <best_hist_json> <avg_hist_json>\n")
        sys.exit(1)

    best_hist = json.loads(sys.argv[1])
    avg_hist  = json.loads(sys.argv[2])

    if not best_hist:
        sys.stderr.write("Empty data\n")
        sys.exit(1)

    BG      = '#0D0D1A'
    SURFACE = '#141428'
    BORDER  = '#2A2A50'
    GREEN   = '#06D6A0'
    YELLOW  = '#F59E0B'
    TEXT    = '#E2E8F0'
    MUTED   = '#94A3B8'

    fig, ax = plt.subplots(figsize=(11, 6), dpi=100)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(SURFACE)

    for sp in ax.spines.values():
        sp.set_color(BORDER)

    ax.tick_params(colors=MUTED, labelsize=9)
    ax.set_title(
        "Curva de Convergencia — Algoritmo Genético",
        color=TEXT, fontsize=13, fontweight='bold',
        fontfamily='monospace', pad=14
    )
    ax.set_xlabel("Generación", color=MUTED, fontfamily='monospace')
    ax.set_ylabel("Fitness",    color=MUTED, fontfamily='monospace')
    ax.grid(True, color=BORDER, alpha=0.4, linestyle=':')

    xs = range(1, len(best_hist) + 1)
    ax.plot(xs, best_hist, color=GREEN,  linewidth=2.2, label='Mejor Fitness', zorder=3)
    ax.plot(xs, avg_hist,  color=YELLOW, linewidth=1.5, linestyle='--', alpha=0.85,
            label='Fitness Promedio', zorder=2)
    ax.fill_between(xs, avg_hist, best_hist, color=GREEN, alpha=0.08)

    best_val = max(best_hist)
    best_idx = best_hist.index(best_val)
    ax.annotate(
        f" {best_val:.4f}",
        xy=(best_idx + 1, best_val),
        color=GREEN,
        fontsize=9,
        fontfamily='monospace',
        arrowprops=dict(arrowstyle='->', color=GREEN, lw=1.2),
        xytext=(best_idx + 1 + max(1, len(best_hist) * 0.04), best_val * 0.97),
    )

    p1 = mpatches.Patch(color=GREEN,  label='Mejor Fitness')
    p2 = mpatches.Patch(color=YELLOW, label='Fitness Promedio')
    leg = ax.legend(handles=[p1, p2], facecolor='#1A1A35',
                    labelcolor=TEXT, fontsize=9, framealpha=0.9)
    leg.get_frame().set_edgecolor(BORDER)

    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor=BG)
    plt.close(fig)

    buf.seek(0)
    sys.stdout.buffer.write(buf.read())

if __name__ == '__main__':
    main()
