export default function DashboardLoading() {
  return (
    <div style={{ padding: "22px 24px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ width: 180, height: 26, borderRadius: 8, background: "var(--line-2)", marginBottom: 10 }} />
          <div style={{ width: 260, height: 14, borderRadius: 8, background: "var(--line-2)" }} />
        </div>
        <div style={{ width: 120, height: 38, borderRadius: 11, background: "var(--indigo-soft)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: index < 4 ? 140 : 220,
              borderRadius: 16,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              boxShadow: "var(--shadow-sm)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
