import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import emailjs from "@emailjs/browser";

// ─── Constants ───
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SEASON_START = new Date(2025, 10, 15); // Nov 15, 2025
const SEASON_END = new Date(2026, 3, 15);    // Apr 15, 2026

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "powder";
const EMAILJS_SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// ─── Helpers ───
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function strToDate(s) {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }
function isInSeason(date) { return date >= SEASON_START && date <= SEASON_END; }

function formatDateRange(start, end) {
  const s = strToDate(start);
  const e = strToDate(end);
  return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function eachDay(startStr, endStr) {
  const days = [];
  let cur = strToDate(startStr);
  const end = strToDate(endStr);
  while (cur <= end) {
    days.push(dateToStr(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return days;
}

const GUEST_COLORS = [
  { bg: "#3B82F6", light: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)" },
  { bg: "#10B981", light: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)" },
  { bg: "#F59E0B", light: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)" },
  { bg: "#EF4444", light: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)" },
  { bg: "#8B5CF6", light: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.4)" },
  { bg: "#EC4899", light: "rgba(236,72,153,0.15)", border: "rgba(236,72,153,0.4)" },
  { bg: "#14B8A6", light: "rgba(20,184,166,0.15)", border: "rgba(20,184,166,0.4)" },
  { bg: "#F97316", light: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.4)" },
];
function getGuestColor(index) { return GUEST_COLORS[index % GUEST_COLORS.length]; }

// ─── Send email notification ───
async function sendEmailNotification(booking) {
  if (!EMAILJS_SERVICE || !EMAILJS_TEMPLATE || !EMAILJS_KEY) {
    console.log("EmailJS not configured — skipping notification");
    return;
  }
  try {
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      guest_count: booking.guest_count,
      dates: formatDateRange(booking.start_date, booking.end_date),
      notes: booking.notes || "None",
    }, EMAILJS_KEY);
    console.log("Email notification sent");
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

// ─── Snowflakes ───
function Snowflakes() {
  const flakes = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 8,
      duration: 6 + Math.random() * 8, size: 2 + Math.random() * 4,
      opacity: 0.2 + Math.random() * 0.4,
    })), []);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {flakes.map(f => (
        <div key={f.id} style={{
          position: "absolute", top: -10, left: `${f.left}%`,
          width: f.size, height: f.size, borderRadius: "50%", background: "#fff", opacity: f.opacity,
          animation: `snowfall ${f.duration}s ${f.delay}s linear infinite`,
        }} />
      ))}
      <style>{`@keyframes snowfall { 0% { transform: translateY(-10px); } 100% { transform: translateY(100vh); } }`}</style>
    </div>
  );
}

// ─── Modal ───
function Modal({ open, onClose, title, children, width }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1a2332", borderRadius: 16, padding: "28px 32px", maxWidth: width || 480,
        width: "100%", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: "#e2e8f0", fontFamily: "'Playfair Display', serif" }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer", padding: "4px 8px", borderRadius: 6,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    if (now >= SEASON_START && now <= SEASON_END) return { year: now.getFullYear(), month: now.getMonth() };
    return { year: SEASON_START.getFullYear(), month: SEASON_START.getMonth() };
  });

  const [selectStart, setSelectStart] = useState(null);
  const [selectEnd, setSelectEnd] = useState(null);
  const [hoveredDate, setHoveredDate] = useState(null);

  const [requestModal, setRequestModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("svq-admin") === "true");
  const [adminPass, setAdminPass] = useState("");
  const [adminLoginModal, setAdminLoginModal] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [notifPanel, setNotifPanel] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [toast, setToast] = useState(null);

  // ─── Load bookings from Supabase ───
  const fetchBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) {
      console.error("Error fetching bookings:", error);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("bookings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBookings]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── Derived data ───
  const dateMap = useMemo(() => {
    const map = {};
    bookings.forEach((b, idx) => {
      if (b.status === "approved") {
        eachDay(b.start_date, b.end_date).forEach(d => { map[d] = { ...b, colorIdx: idx }; });
      }
    });
    return map;
  }, [bookings]);

  const pendingDates = useMemo(() => {
    const set = new Set();
    bookings.filter(b => b.status === "pending").forEach(b => {
      eachDay(b.start_date, b.end_date).forEach(d => set.add(d));
    });
    return set;
  }, [bookings]);

  const pendingCount = useMemo(() => bookings.filter(b => b.status === "pending").length, [bookings]);

  const isDateAvailable = useCallback((dateStr) => !dateMap[dateStr], [dateMap]);
  const isRangeAvailable = useCallback((start, end) => eachDay(start, end).every(d => isDateAvailable(d)), [isDateAvailable]);

  const selectionRange = useMemo(() => {
    if (!selectStart) return new Set();
    const end = selectEnd || hoveredDate || selectStart;
    const s = selectStart < end ? selectStart : end;
    const e = selectStart < end ? end : selectStart;
    return new Set(eachDay(s, e));
  }, [selectStart, selectEnd, hoveredDate]);

  const upcomingStays = useMemo(() =>
    bookings.filter(b => b.status === "approved").sort((a, b) => a.start_date.localeCompare(b.start_date)),
  [bookings]);

  // ─── Actions ───
  const handleDateClick = (dateStr) => {
    if (!isInSeason(strToDate(dateStr)) || !isDateAvailable(dateStr)) return;
    if (!selectStart || selectEnd) {
      setSelectStart(dateStr);
      setSelectEnd(null);
    } else {
      const start = dateStr < selectStart ? dateStr : selectStart;
      const end = dateStr < selectStart ? selectStart : dateStr;
      if (isRangeAvailable(start, end)) {
        setSelectStart(start);
        setSelectEnd(end);
        setRequestModal(true);
      } else {
        showToast("Some dates in that range are already booked", "error");
        setSelectStart(dateStr);
        setSelectEnd(null);
      }
    }
  };

  const handleSubmitRequest = async () => {
    if (!guestName.trim() || !guestEmail.trim()) {
      showToast("Please fill in your name and email", "error");
      return;
    }
    const booking = {
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      notes: guestNotes.trim(),
      guest_count: guestCount,
      start_date: selectStart,
      end_date: selectEnd || selectStart,
      status: "pending",
    };

    const { error } = await supabase.from("bookings").insert([booking]);
    if (error) {
      showToast("Error submitting request. Please try again.", "error");
      console.error(error);
      return;
    }

    // Send email notification
    await sendEmailNotification(booking);

    setSubmitStatus("success");
    showToast("Request submitted! The owner will review it shortly.");
    setTimeout(() => {
      setRequestModal(false);
      setSelectStart(null); setSelectEnd(null);
      setGuestName(""); setGuestEmail(""); setGuestNotes(""); setGuestCount(1);
      setSubmitStatus(null);
    }, 1500);
  };

  const handleApprove = async (id) => {
    const booking = bookings.find(b => b.id === id);
    const approvedOthers = bookings.filter(b => b.id !== id && b.status === "approved");
    const days = eachDay(booking.start_date, booking.end_date);
    const conflict = approvedOthers.some(other =>
      eachDay(other.start_date, other.end_date).some(d => days.includes(d))
    );
    if (conflict) { showToast("Conflict: dates overlap with an existing approved booking", "error"); return; }

    const { error } = await supabase.from("bookings").update({ status: "approved" }).eq("id", id);
    if (error) { showToast("Error approving", "error"); return; }
    showToast(`Approved ${booking.guest_name}'s stay!`);
  };

  const handleReject = async (id) => {
    const booking = bookings.find(b => b.id === id);
    const { error } = await supabase.from("bookings").update({ status: "rejected" }).eq("id", id);
    if (error) { showToast("Error rejecting", "error"); return; }
    showToast(`Rejected ${booking.guest_name}'s request. Dates are now open.`);
  };

  const handleRevokeApproval = async (id) => {
    const booking = bookings.find(b => b.id === id);
    const { error } = await supabase.from("bookings").update({ status: "rejected" }).eq("id", id);
    if (error) { showToast("Error revoking", "error"); return; }
    showToast(`Revoked ${booking.guest_name}'s approval. Dates are now open.`);
  };

  const handleDeleteBooking = async (id) => {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) { showToast("Error deleting", "error"); return; }
    showToast("Booking removed.");
  };

  const handleAdminLogin = () => {
    if (adminPass === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem("svq-admin", "true");
      setAdminLoginModal(false);
      setAdminPass("");
      showToast("Welcome back, owner!");
    } else {
      showToast("Incorrect password", "error");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem("svq-admin");
    setAdminModal(false);
    showToast("Logged out");
  };

  const prevMonth = () => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  // ─── Render Calendar Grid ───
  const renderCalendar = () => {
    const { year, month } = currentMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} style={{ aspectRatio: "1", minHeight: 44 }} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = dateToStr(date);
      const inSeason = isInSeason(date);
      const booked = dateMap[dateStr];
      const isPending = pendingDates.has(dateStr);
      const isSelected = selectionRange.has(dateStr);
      const isToday = dateToStr(new Date()) === dateStr;
      const color = booked ? getGuestColor(booked.colorIdx) : null;

      let bg = "transparent", border = "1px solid transparent", textColor = inSeason ? "#cbd5e1" : "#3e4a5a";
      let cursor = inSeason && !booked ? "pointer" : "default", fontWeight = "normal";

      if (booked) {
        bg = color.light; border = `1px solid ${color.border}`; textColor = color.bg; fontWeight = "600";
      } else if (isSelected && inSeason) {
        bg = "rgba(56,189,248,0.2)"; border = "1px solid rgba(56,189,248,0.5)"; textColor = "#38bdf8"; fontWeight = "600";
      } else if (isToday) {
        border = "1px solid rgba(255,255,255,0.3)";
      }

      cells.push(
        <div key={day} onClick={() => inSeason && handleDateClick(dateStr)}
          onMouseEnter={() => selectStart && !selectEnd && setHoveredDate(dateStr)}
          onMouseLeave={() => setHoveredDate(null)}
          title={booked ? booked.guest_name : ""}
          style={{
            aspectRatio: "1", minHeight: 44, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", borderRadius: 10,
            background: bg, border, color: textColor, cursor, fontWeight,
            fontSize: 14, transition: "all 0.15s ease", position: "relative", opacity: inSeason ? 1 : 0.3,
          }}>
          {day}
          {booked && <div style={{ fontSize: 8, marginTop: 2, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.8 }}>{booked.guest_name.split(" ")[0]}</div>}
          {isPending && isAdmin && !booked && <div style={{ position: "absolute", top: 3, right: 3, width: 6, height: 6, borderRadius: "50%", background: "#fbbf24" }} />}
        </div>
      );
    }
    return cells;
  };

  // ─── Styles ───
  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
  };
  const labelStyle = { fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" };
  const btnBase = { borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1724", color: "#94a3b8" }}>
        Loading...
      </div>
    );
  }

  const { year, month } = currentMonth;

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(175deg, #0b1120 0%, #162032 40%, #1a2a42 100%)",
      fontFamily: "'DM Sans', sans-serif", color: "#e2e8f0", position: "relative", overflow: "hidden",
    }}>
      <Snowflakes />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2000,
          background: toast.type === "error" ? "#dc2626" : "#059669", color: "#fff",
          padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "fadeIn 0.3s ease",
        }}>{toast.msg}</div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>

      {/* ─── Header ─── */}
      <div style={{ position: "relative", zIndex: 1, padding: "40px 24px 20px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 36, fontFamily: "'Playfair Display', serif", fontWeight: 700,
              background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -0.5,
            }}>❄️ Steamboat Val Gardenia 1</h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase" }}>
              2025 – 2026 Season · Guest Calendar
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {isAdmin && (
              <button onClick={() => setNotifPanel(true)} style={{
                ...btnBase, position: "relative", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontWeight: 500,
              }}>
                🔔 Requests
                {pendingCount > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCount}</span>
                )}
              </button>
            )}
            {isAdmin ? (
              <button onClick={() => setAdminModal(true)} style={{ ...btnBase, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>⛷️ Owner Mode</button>
            ) : (
              <button onClick={() => setAdminLoginModal(true)} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontWeight: 500 }}>🔑 Owner Login</button>
            )}
          </div>
        </div>

        <div style={{
          marginTop: 20, padding: "14px 18px", borderRadius: 12,
          background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.12)",
          fontSize: 13, color: "#7dd3fc", lineHeight: 1.6,
        }}>
          {selectStart && !selectEnd
            ? "👆 Now click your departure date to complete the range"
            : "Click a start date, then an end date on the calendar below to request a stay. Colored blocks are already booked."}
        </div>
      </div>

      {/* ─── Calendar ─── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "0 24px 24px" }}>
        <div style={{
          background: "rgba(255,255,255,0.03)", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.06)", padding: "24px 28px", backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={prevMonth} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 16 }}>←</button>
            <h2 style={{ margin: 0, fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>{MONTHS_SHORT[month]} {year}</h2>
            <button onClick={nextMonth} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 16 }}>→</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", padding: "4px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {renderCalendar()}
          </div>
        </div>

        {/* Confirmed Stays */}
        {upcomingStays.length > 0 && (
          <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Confirmed Stays</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcomingStays.map((stay) => {
                const color = getGuestColor(bookings.indexOf(stay));
                return (
                  <div key={stay.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10, background: color.light, border: `1px solid ${color.border}`, flexWrap: "wrap", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color.bg, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{stay.guest_name}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{formatDateRange(stay.start_date, stay.end_date)}</span>
                      {stay.guest_count > 1 && <span style={{ fontSize: 12, color: "#64748b" }}>({stay.guest_count} guests)</span>}
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleRevokeApproval(stay.id)} style={{
                        background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                        color: "#ef4444", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                      }}>Revoke</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Request Modal ─── */}
      <Modal open={requestModal} onClose={() => { setRequestModal(false); setSelectStart(null); setSelectEnd(null); }} title="Request a Stay">
        {submitStatus === "success" ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ color: "#10b981", fontSize: 16, fontWeight: 600 }}>Request Submitted!</p>
            <p style={{ color: "#64748b", fontSize: 13 }}>The owner will review your request and you'll hear back soon.</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", fontSize: 14, color: "#7dd3fc" }}>
              📅 {selectStart ? formatDateRange(selectStart, selectEnd || selectStart) : "Select dates"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={labelStyle}>Your Name *</label><input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Jane Smith" style={inputStyle} /></div>
              <div><label style={labelStyle}>Email *</label><input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="jane@email.com" type="email" style={inputStyle} /></div>
              <div><label style={labelStyle}>Number of Guests</label><input value={guestCount} onChange={e => setGuestCount(Math.max(1, Number(e.target.value)))} type="number" min={1} max={20} style={{ ...inputStyle, width: 80 }} /></div>
              <div><label style={labelStyle}>Notes (optional)</label><textarea value={guestNotes} onChange={e => setGuestNotes(e.target.value)} placeholder="Anything the owner should know..." rows={3} style={{ ...inputStyle, resize: "vertical" }} /></div>
              <button onClick={handleSubmitRequest} style={{
                marginTop: 6, padding: "12px 24px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #0ea5e9, #3b82f6)", color: "#fff",
                fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 16px rgba(14,165,233,0.3)",
              }}>Submit Request</button>
            </div>
          </>
        )}
      </Modal>

      {/* ─── Admin Login ─── */}
      <Modal open={adminLoginModal} onClose={() => { setAdminLoginModal(false); setAdminPass(""); }} title="Owner Login">
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px" }}>Enter the owner password to manage bookings.</p>
        <input value={adminPass} onChange={e => setAdminPass(e.target.value)} type="password" placeholder="Password"
          onKeyDown={e => e.key === "Enter" && handleAdminLogin()} style={{ ...inputStyle, marginBottom: 14 }} />
        <button onClick={handleAdminLogin} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff",
          fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>Login</button>
      </Modal>

      {/* ─── Admin Dashboard ─── */}
      <Modal open={adminModal} onClose={() => setAdminModal(false)} title="Owner Dashboard" width={560}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Approved", count: bookings.filter(b => b.status === "approved").length, color: "#10b981" },
              { label: "Pending", count: pendingCount, color: "#fbbf24" },
              { label: "Rejected", count: bookings.filter(b => b.status === "rejected").length, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={handleAdminLogout} style={{
            padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Logout</button>
        </div>
      </Modal>

      {/* ─── Manage Requests Panel ─── */}
      <Modal open={notifPanel} onClose={() => setNotifPanel(false)} title="Manage Requests" width={620}>
        {bookings.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: 20 }}>No requests yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["pending", "approved", "rejected"].map(status => {
              const filtered = bookings.filter(b => b.status === status);
              if (filtered.length === 0) return null;
              return (
                <div key={status}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5,
                    color: status === "pending" ? "#fbbf24" : status === "approved" ? "#10b981" : "#64748b",
                    marginBottom: 8, marginTop: 8,
                  }}>{status} ({filtered.length})</div>
                  {filtered.map(b => (
                    <div key={b.id} style={{
                      padding: "14px 16px", borderRadius: 12, marginBottom: 8,
                      background: status === "pending" ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${status === "pending" ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: "#e2e8f0" }}>{b.guest_name}</div>
                          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{b.guest_email}</div>
                          <div style={{ fontSize: 13, color: "#7dd3fc", marginTop: 4 }}>📅 {formatDateRange(b.start_date, b.end_date)} · {b.guest_count} guest{b.guest_count > 1 ? "s" : ""}</div>
                          {b.notes && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>"{b.notes}"</div>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {status === "pending" && (
                            <>
                              <button onClick={() => handleApprove(b.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Approve</button>
                              <button onClick={() => handleReject(b.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Reject</button>
                            </>
                          )}
                          {status === "approved" && (
                            <button onClick={() => handleRevokeApproval(b.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Revoke</button>
                          )}
                          <button onClick={() => handleDeleteBooking(b.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
