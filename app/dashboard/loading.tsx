const cardHeights = [104, 104, 104, 104, 260, 260, 200, 200];

function SkeletonBlock({
  width,
  height,
  radius = 8,
  tone = "var(--line-2)",
}: {
  width: number | string;
  height: number;
  radius?: number;
  tone?: string;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: tone,
      }}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div style={{ padding: "22px 24px 40px", minWidth: 0 }}>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          marginBottom: 18,
        }}
      >
        <div>
          <SkeletonBlock width={190} height={28} radius={7} />
          <div style={{ marginTop: 10 }}>
            <SkeletonBlock width={320} height={14} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <SkeletonBlock width={126} height={38} radius={10} />
          <SkeletonBlock width={42} height={38} radius={10} tone="var(--indigo-soft)" />
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {cardHeights.map((height, index) => (
          <div
            key={index}
            style={{
              height,
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <SkeletonBlock width={index < 4 ? 74 : 122} height={13} />
            <div style={{ marginTop: 12 }}>
              <SkeletonBlock width={index < 4 ? 110 : "88%"} height={index < 4 ? 26 : 16} radius={7} />
            </div>
            {index >= 4 && (
              <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                <SkeletonBlock width="100%" height={42} radius={10} />
                <SkeletonBlock width="92%" height={42} radius={10} />
                <SkeletonBlock width="76%" height={42} radius={10} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
