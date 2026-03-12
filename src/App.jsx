import { useState, useEffect } from "react";
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  doc, deleteDoc, serverTimestamp, setDoc, getDoc 
} from "firebase/firestore";
import { db } from "./firebase";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="#333" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '10px', fontWeight: 'bold' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function App() {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("食品");
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [monthlyBudget, setMonthlyBudget] = useState(90000);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [tempBudget, setTempBudget] = useState("");

  useEffect(() => {
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setItems(data || []);
    }, (error) => console.error("Firebase Error:", error));

    const fetchBudget = async () => {
      try {
        const budgetDoc = await getDoc(doc(db, "settings", "budget"));
        if (budgetDoc.exists()) {
          const val = budgetDoc.data().value;
          setMonthlyBudget(val);
          setTempBudget(val);
        }
      } catch (e) { console.error("Budget Fetch Error:", e); }
    };
    fetchBudget();
    return () => unsubscribe();
  }, []);

  // 📅 期間計算（エラーが出にくい書き方に修正）
  const getPeriod = (refDate) => {
    const d = new Date(refDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    
    let start, end;
    if (day <= 15) {
      start = new Date(y, m - 1, 16, 0, 0, 0);
      end = new Date(y, m, 15, 23, 59, 59);
    } else {
      start = new Date(y, m, 16, 0, 0, 0);
      end = new Date(y, m + 1, 15, 23, 59, 59);
    }
    return { start, end };
  };

  const todayPeriod = getPeriod(new Date());
  // 先月の基準日：今サイクルの開始日の1日前
  const lastMonthRef = new Date(todayPeriod.start);
  lastMonthRef.setDate(lastMonthRef.getDate() - 1);
  const lastPeriod = getPeriod(lastMonthRef);

  const getSum = (period) => {
    return items.reduce((sum, item) => {
      if (!item.date) return sum;
      const itemDate = new Date(item.date);
      if (itemDate >= period.start && itemDate <= period.end) {
        return sum + (Number(item.amount) || 0);
      }
      return sum;
    }, 0);
  };

  const currentTotal = getSum(todayPeriod);
  const lastTotal = getSum(lastPeriod);
  const carryOver = monthlyBudget - lastTotal;
  const remaining = (monthlyBudget + carryOver) - currentTotal;

  const chartData = items.reduce((acc, item) => {
    if (!item.date) return acc;
    const itemDate = new Date(item.date);
    if (itemDate >= todayPeriod.start && itemDate <= todayPeriod.end) {
      const found = acc.find((c) => c.name === item.category);
      if (found) { found.value += Number(item.amount); }
      else { acc.push({ name: item.category, value: Number(item.amount) }); }
    }
    return acc;
  }, []);

  const COLORS = ["#FF8042", "#0088FE", "#00C49F", "#FFBB28", "#84d8ff", "#8884d8"];

  const handleUpdateBudget = async () => {
    if (!tempBudget) return;
    await setDoc(doc(db, "settings", "budget"), { value: Number(tempBudget) });
    setMonthlyBudget(Number(tempBudget));
    setIsSettingOpen(false);
  };

  const handleAdd = async () => {
    if (!amount) return;
    await addDoc(collection(db, "kakeibo"), { amount: Number(amount), memo, category, date });
    setAmount(""); setMemo("");
  };

  return (
    <div style={{ width: "100%", maxWidth: "480px", margin: "0 auto", padding: "12px", fontFamily: "sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <img src="/icon.png" alt="logo" style={{ width: '32px', height: '32px', borderRadius: '6px', marginRight: '10px' }} onClick={() => window.location.reload()} />
        <h1 style={{ fontSize: '18px', margin: 0 }}>My Kakeibo</h1>
        <button onClick={() => setIsSettingOpen(!isSettingOpen)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '20px' }}>⚙️</button>
      </header>

      {isSettingOpen && (
        <div style={{ padding: "12px", backgroundColor: "#eee", borderRadius: "8px", marginBottom: "12px" }}>
          <input type="number" value={tempBudget} onChange={(e) => setTempBudget(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px' }} />
          <button onClick={handleUpdateBudget} style={{ width: '100%', padding: '8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>予算保存</button>
        </div>
      )}

      <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "16px" }}>
        <div style={{ fontSize: '11px', color: '#888' }}>
          期間: {todayPeriod.start.toLocaleDateString()}〜{todayPeriod.end.toLocaleDateString()}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
          <span>基本予算:</span> <span>{monthlyBudget.toLocaleString()}円</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: carryOver >= 0 ? 'blue' : 'red' }}>
          <span>前回繰越:</span> <span>{carryOver >= 0 ? "+" : ""}{carryOver.toLocaleString()}円</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '1.2em', fontWeight: 'bold' }}>
          <span>残り:</span> <span style={{ color: remaining < 0 ? 'red' : 'green' }}>{remaining.toLocaleString()}円</span>
        </div>
      </div>

      <div style={{ backgroundColor: "#f0f2f5", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
        <input type="number" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <option value="食品">食品</option><option value="日用品">日用品</option><option value="外食">外食</option>
          <option value="光熱費">光熱費</option><option value="こたちゃん">こたちゃん</option><option value="その他">その他</option>
        </select>
        <button onClick={handleAdd} style={{ width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>追加</button>
      </div>

      {chartData.length > 0 && (
        <div style={{ height: '200px', marginBottom: '20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" label={renderCustomizedLabel}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}