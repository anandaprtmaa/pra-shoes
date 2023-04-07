import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { client } from "./db.js";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";

const app = express();
import multer from "multer";

// MIDDLEWARE
// Untuk mengelola cookie
app.use(cookieParser());

//Untuk memeriksa otorisasi
app.use((req, res, next) => {
  if (
    req.path.startsWith("/api/login") ||
    req.path.startsWith("/api/login/admin") ||
    req.path.startsWith("/assets") ||
    req.path.startsWith("/halaman-utama") ||
    req.path.startsWith("/daftar") ||
    req.path.startsWith("/api/daftar") ||
    req.path.startsWith("/login-admin") ||
    req.path.startsWith("/login-user")
  ) {
    next();
  } else {
    let authorized = false;
    if (req.cookies.token) {
      try {
        jwt.verify(req.cookies.token, process.env.SECRET_KEY);
        authorized = true;
      } catch (err) {
        res.setHeader("Cache-Control", "no-store"); // khusus Vercel
        res.clearCookie("token");
      }
    
    }
    if (authorized) {
      if (req.path.startsWith("/halaman-utama")) {
        res.redirect("/");
      } else {
        next();
      }
    } else {
      if (req.path.startsWith("/halaman-utama")) {
        next();
      } else {
        if (req.path.startsWith("/api")) {
          res.status(401);
          res.send("Anda harus login terlebih dahulu.");
        } else {
          res.redirect("/halaman-utama");
        }
      }
    }
  }
});

// Untuk mengakses file statis
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "public/photo" });

// Untuk membaca body berformat JSON
app.use(express.json());

// ROUTE OTORISASI
app.post("/api/login", async (req, res) => {
  const results = await client.query(
    `SELECT * FROM pendaftaran where username='${req.body.username}'`
  );
  if (results.rows.length > 0) {
    if (await bcrypt.compare(req.body.password, results.rows[0].password)) {
      const token = jwt.sign(results.rows[0], process.env.SECRET_KEY);
      res.cookie("token", token);
      res.send("Login berhasil.");
    } else {
      res.status(401);
      res.send("Kata sandi salah.");
    }
  } else {
    res.status(401);
    res.send("Pengguna tidak ditemukan.");
  }
});

//untuk login admin
app.post("/api/login/admin", async (req, res) => {
  const results = await client.query(
    `SELECT * FROM admin WHERE username ='${req.body.username}'`
  );
  if (results.rows.length > 0) {
    if (await bcrypt.compare(req.body.password, results.rows[0].password)) {
      const token = jwt.sign(results.rows[0], process.env.SECRET_KEY);
      res.cookie("token", token);
      res.send("Login berhasil.");
    } else {
      res.status(401);
      res.send("Kata sandi salah.");
    }
  } else {
    res.status(401);
    res.send("Pengguna tidak ditemukan.");
  }
});
const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash("321", salt);
console.log(hash);

// Dapatkan pengguna saat ini (yang sedang login)
app.get("/api/me", (req, res) => {
  const me = jwt.verify(req.cookies.token, process.env.SECRET_KEY);
  res.json(me);
});

// Logout (hapus token)
app.get("/api/logout", (_req, res) => {
  res.setHeader("Cache-Control", "no-store"); // khusus Vercel
  res.clearCookie("token");
  res.send("Logout berhasil.");
});

// ROUTE MAHASISWA
// Dapatkan semua
app.get("/api/detail", async (_req, res) => {
  const results = await client.query("SELECT * FROM detail_barang");
  res.json(results.rows);
});

// Dapatkan satu
app.get("/api/mahasiswa/:id", async (req, res) => {
  const results = await client.query(
    `SELECT * FROM mahasiswa WHERE id = ${req.params.id}`
  );
  res.json(results.rows[0]);
});

// Tambah pengguna
app.post("/api/daftar", async (req, res) => {
  const salt = await bcrypt.genSalt();
  const hash = await bcrypt.hash(req.body.password, salt);
  await client.query(
    `INSERT INTO pendaftaran (username,nama,password,telepon) VALUES ('${req.body.username}','${req.body.nama}','${hash}','${req.body.telepon}')`
  );
  res.send("akun berhasil daftar.");
});

//login admin
app.post("/api/login/admin", async (req, res) => {
  const results = await client.query(
    `SELECT * FROM admin where username='${req.body.username}'`
  );
  if (results.rows.length > 0) {
    if (await bcrypt.compare(req.body.password, results.rows[0].password)) {
      const token = jwt.sign(results.rows[0], process.env.SECRET_KEY);
      res.cookie("token", token);
      res.send("Login berhasil.");
    } else {
      res.status(401);
      res.send("Kata sandi salah.");
    }
  } else {
    res.status(401);
    res.send("Pengguna tidak ditemukan.");
  }
});

// Dapatkan semua pengguna
app.get("/api/pelatihan", async (_req, res) => {
  const results = await client.query("SELECT * FROM daftar");
  res.json(results.rows);
});

//keluar
app.get("/api/keluar", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

//ROUTE BARANG
//tampil semua
app.get("/api/barang", async (_req, res) => {
  const results = await client.query("SELECT * FROM barang");
  res.json(results.rows);
});

// Tambah barang
app.post("/api/barang", upload.single("foto"), async (req, res) => {
  await client.query(
    `INSERT INTO barang (nama,harga,stok,foto) VALUES ('${req.body.nama}','${req.body.harga}','${req.body.stok}','${req.file.filename}')`
  );
  res.send("barang berhasil di tambah.");
});

// Edit barang
app.put("/api/barang/:id", upload.single("foto"), async (req, res) => {
  await client.query(
    `UPDATE barang SET nama = '${req.body.nama}', harga =  '${req.body.harga}', stok = '${req.body.stok}' ,foto='${req.file.filename}' WHERE id=${req.params.id}`
  );
  res.send("barang berhasil diedit.");
});

// Hapus
app.delete("/api/barang/:id", async (req, res) => {
  await client.query(`
  DELETE FROM barang WHERE id = ${req.params.id}`);
  res.send("barang berhasil dihapus.");
});

app.listen(3000, () => {
  console.log("Server berhasil berjalan.");
});
