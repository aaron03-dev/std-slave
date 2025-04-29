const express = require('express');
const router = express.Router();
const { startExe, stopExe, deleteExe, getCurrentFolder } = require('../Services/exeService');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { spawn } = require("child_process");
const { exec } = require('child_process'); // Thêm child_process

let lastFolderName = ''; // Lưu tên thư mục output khi chạy file .exe


// 👉 Route để chạy file exe
router.post('/start', (req, res) => {
    const { folderName } = req.body;

    if (!folderName) {
        return res.status(400).json({ message: 'folderName is required' });
    }

    lastFolderName = folderName;

    try {
        startExe(folderName); // Gọi hàm chạy exe
        res.json({ message: 'Đã chạy file exe' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 👉 Route để dừng file exe
router.post('/stop', (req, res) => {
    try {
        stopExe();
        res.json({ message: 'Đã dừng file exe' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 👉 Route để xóa file exe
router.delete('/delete', (req, res) => {
    try {
        deleteExe();
        res.json({ message: 'Đã xóa file exe' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

let ftpProcess = null;

async function zipFolderWithoutCompression(sourceFolder, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = archiver("zip", { store: true }); // Không nén, chỉ đóng gói

        output.on("close", () => resolve(outPath));
        archive.on("error", (err) => reject(err));

        archive.pipe(output);
        archive.directory(sourceFolder, false);
        archive.finalize();
    });
}

router.post("/start-ftp", async (req, res) => {
    let folder = req.query.folder;
    console.log(`📂 Nhận đường dẫn chia sẻ: ${folder}`);

    if (!folder) return res.status(400).json({ error: "Thiếu thư mục chia sẻ" });

    folder = folder.replace(/[:]+$/, ""); // Chuẩn hóa đường dẫn
    console.log(`📂 Đường dẫn sau khi chuẩn hóa: ${folder}`);

    if (!fs.existsSync(folder) || !fs.lstatSync(folder).isDirectory()) {
        return res.status(400).json({ error: "Thư mục không tồn tại hoặc không hợp lệ" });
    }

    const zipFileName = `${path.basename(folder)}.zip`;
    const zipFilePath = path.join(path.dirname(folder), zipFileName);

    console.log(`📦 Đang đóng gói thư mục vào: ${zipFilePath}`);

    try {
        await zipFolderWithoutCompression(folder, zipFilePath);
        console.log(`✅ Đóng gói hoàn tất: ${zipFilePath}`);

        if (ftpProcess && !ftpProcess.killed) {
            ftpProcess.kill();
        }

        const ftpScriptPath = "D:/ftp-server.txt";
        ftpProcess = spawn("python", [ftpScriptPath, zipFilePath]);

        ftpProcess.stdout.on("data", (data) => {
            console.log(`[FTP] ${data}`);
        });

        ftpProcess.stderr.on("data", (data) => {
            console.error(`[FTP Error] ${data}`);
        });

        res.json({ message: "✅ Đã bật FTP chia sẻ file ZIP: " + zipFilePath });
    } catch (error) {
        console.error(`❌ Lỗi khi đóng gói thư mục: ${error.message}`);
        res.status(500).json({ error: "Không thể đóng gói thư mục" });
    }
});



router.get('/liveview', (req, res) => {
    const isOn = req.query.on !== undefined;

    if (isOn) {
        const filePath = path.join(__dirname, '../..', 'sv.txt.txt');
        const folderPath = path.dirname(filePath); // Lấy thư mục chứa file
        console.log("đang chạy sv py")

        // Lệnh chạy file Python
        const command = `py "${filePath}"`;

        // Thực thi lệnh
        exec(command, { cwd: folderPath }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Lỗi khi chạy server Python: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`❌ Lỗi Python: ${stderr}`);
                return;
            }
            console.log(`✅ Server Python đã chạy: ${stdout}`);
        });
    } else {
        //stopPythonServer()
        res.send('🛑 Liveview stopped');
    }
});

module.exports = router;
