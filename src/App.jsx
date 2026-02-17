import { useState, useEffect } from "react";
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  doc, deleteDoc, serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase";
// 📊 グラフ用の部品をインポート
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function App() {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("食品");
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const monthlyBudget = 90000;
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = monthlyBudget - total;

  useEffect(() => {
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(data);
    });
    return () => unsubscribe();
  }, []);

  // 📈 カテゴリごとに集計するデータ作成
  const chartData = items.reduce((acc, item) => {
    const found = acc.find((c) => c.name === item.category);
    if (found) {
      found.value += Number(item.amount);
    } else {
      acc.push({ name: item.category, value: Number(item.amount) });
    }
    return acc;
  }, []);

  // 🎨 グラフの色設定
  const COLORS = ["#FF8042", "#0088FE", "#00C49F", "#FFBB28", "#84d8ff", "#8884d8"];

  const handleAdd = async () => {
    if (!amount) return;
    try {
      await addDoc(collection(db, "kakeibo"), {
        amount: Number(amount),
        memo,
        category,
        date: date,
        createdAt: serverTimestamp(),
      });
      setAmount("");
      setMemo("");
    } catch (e) {
      console.error(e);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("この明細を削除しますか？")) return;
    await deleteDoc(doc(db, "kakeibo", id));
  };

  const groupedItems = items.reduce((groups, item) => {
    const d = item.date || "日付なし";
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedItems).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div style={styles.container}>
      <header style={headerStyle}>
        <img src="/icon.png" alt="logo" style={logoStyle} />
        <h1 style={titleStyle}>My Kakeibo</h1>
      </header>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
      <input type="number" placeholder="金額（円）" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
      
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.select}>
        <option value="食品">食品</option>
        <option value="日用品">日用品</option>
        <option value="外食">外食</option>
        <option value="光熱費">光熱費</option>
        <option value="こたちゃん">こたちゃん</option>
        <option value="その他">その他</option>
      </select>

      <input placeholder="お店の名前など" value={memo} onChange={(e) => setMemo(e.target.value)} style={styles.input} />

      <button onClick={handleAdd} style={styles.button}>追加</button>

      <div style={styles.summary}>
        <h2>合計：{total.toLocaleString()} 円</h2>
        <h2 style={{ color: remaining < 0 ? "red" : "black" }}>残り：{remaining.toLocaleString()} 円</h2>
      </div>

      {/* 📊 円グラフを表示するエリア */}
      {items.length > 0 && (
        <div style={styles.chartContainer}>
          <h3 style={{ textAlign: "center", marginBottom: "10px" }}>カテゴリー別割合</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value.toLocaleString()}円`} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.listContainer}>
        {sortedDates.map((dateString) => (
          <div key={dateString} style={{ marginBottom: "20px" }}>
            <div style={styles.dateHeader}>{dateString.replace(/-/g, "/")} ▼</div>
            {groupedItems[dateString].map((item) => (
              <div key={item.id} style={styles.listItem}>
                <span>
                  {item.category} ／ <strong>{Number(item.amount).toLocaleString()}円</strong>
                  {item.memo && <span style={{ color: "#666", fontSize: "14px" }}> （{item.memo}）</span>}
                </span>
                <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn}>🗑️</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// 💥 スタイル定義（ここが切れているとエラーになります）
const styles = {
  container: { width: "100%", maxWidth: "480px", margin: "0 auto", padding: "16px", fontFamily: "sans-serif" },
  input: { width: "100%", padding: "12px", marginBottom: "8px", fontSize: "16px", boxSizing: "border-box", border: "1px solid #ccc", borderRadius: "4px" },
  select: { width: "100%", padding: "12px", fontSize: "16px", marginBottom: "8px", borderRadius: "4px", boxSizing: "border-box" },
  button: { width: "100%", padding: "12px", fontSize: "16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" },
  summary: { marginTop: "20px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "8px" },
  chartContainer: { marginTop: "30px", padding: "10px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  listContainer: { marginTop: "20px" },
  dateHeader: { fontWeight: "bold", fontSize: "16px", margin: "15px 0 5px", color: "#97f128ff" },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eee" },
  deleteBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "18px" }
};

const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px 0' };
const logoStyle = { width: '40px', height: '40px', borderRadius: '8px' };
const titleStyle = { fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#333' };