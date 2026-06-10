# Android APK 构建与发布指南

本文说明如何将本项目打包为 Android APK，并通过 `/download/` 页面供用户侧载安装。

## 前置要求

| 工具 | 说明 |
|------|------|
| **Node.js 18+** | 已安装 |
| **Android Studio** | [下载](https://developer.android.com/studio)，含 Android SDK |
| **JDK 17** | Android Studio 通常自带 |

首次打开 Android Studio 时，按向导安装 **Android SDK Platform 34+** 与 **Build-Tools**。

---

## 1. 配置 API 地址

APK 内无法使用 Vite 开发代理，需指向已部署的 Cloudflare 线上地址：

```bash
# 复制示例并修改域名
cp .env.production.example .env.production
```

编辑 `.env.production`：

```env
VITE_API_BASE_URL=https://cursor0611.pages.dev
```

将域名换成你的 Cloudflare Pages 实际地址。确保该域名 `/api/health` 返回 `hasDashScopeKey: true`。

> `.env.production` 已在 `.gitignore` 规则之外——请勿提交含敏感信息的文件；其中只有公开 API 域名，可提交也可不提交。

---

## 2. 构建 Web 资源并同步到 Android

```bash
npm install
npm run cap:sync
```

该命令等价于 `npm run build && npx cap sync android`，会把 `dist/` 复制到 Android 工程。

---

## 3. 在 Android Studio 中打开项目

```bash
npm run cap:open
```

或手动打开项目根目录下的 `android/` 文件夹。

---

## 4. 调试版 APK（内测）

1. Android Studio → **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. 完成后点击通知 **locate**
3. 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

调试版可直接安装，但会提示「未通过 Play 保护机制验证」。

---

## 5. 正式版 Release APK（对外分发）

### 5.1 生成签名密钥（只需一次）

在项目根目录执行：

```bash
keytool -genkey -v -keystore android-release.keystore -alias usidphoto -keyalg RSA -keysize 2048 -validity 10000
```

按提示填写信息并记住 **keystore 密码** 与 **alias**。

> **务必备份** `android-release.keystore`！丢失后无法覆盖安装更新，用户只能卸载重装。

建议将 keystore 路径加入 `.gitignore`（已配置 `*.keystore`）。

### 5.2 配置 Gradle 签名

在 `android/` 目录创建 `keystore.properties`（勿提交 Git）：

```properties
storeFile=../../android-release.keystore
storePassword=你的密码
keyAlias=usidphoto
keyPassword=你的密码
```

参考 `android/keystore.properties.example`。

### 5.3 构建 Release APK

Android Studio：

1. **Build** → **Generate Signed Bundle / APK**
2. 选择 **APK**（不是 AAB）
3. 选择 keystore，输入密码
4. Build variant 选 **release**
5. 输出：`android/app/build/outputs/apk/release/app-release.apk`

命令行（需已配置 `keystore.properties`）：

```bash
cd android
./gradlew assembleRelease
```

Windows：

```powershell
cd android
.\gradlew.bat assembleRelease
```

---

## 6. 发布到下载页

将 release APK 复制到静态资源目录并重命名：

```bash
cp android/app/build/outputs/apk/release/app-release.apk public/download/american-id-photo.apk
```

然后部署网站（Git push 触发 Cloudflare Pages，或 `npm run build` 后上传 `dist`）。

用户访问：

```
https://你的域名/download/
```

即可下载安装。

---

## 7. 常用命令

| 命令 | 说明 |
|------|------|
| `npm run cap:sync` | 构建 Web + 同步到 Android |
| `npm run cap:open` | 用 Android Studio 打开 |
| `npm run cap:run` | 同步后在连接的设备/模拟器上运行 |

---

## 8. 权限说明

App 使用以下 Android 权限（由 Capacitor 插件自动声明）：

| 权限 | 用途 |
|------|------|
| `CAMERA` | 拍摄证件照 |
| `READ_MEDIA_IMAGES` | 从相册选择（Android 13+） |
| `INTERNET` | 调用 Cloudflare API |

---

## 9. 版本更新

1. 修改 `package.json` 的 `version`
2. 修改 `android/app/build.gradle` 中的 `versionCode`（整数 +1）和 `versionName`
3. 重新 `npm run cap:sync` 并用**同一 keystore** 签名
4. 更新 `public/download/american-id-photo.apk` 并重新部署

用户安装新版本时需覆盖安装；若更换 keystore，需先卸载旧版。

---

## 10. 故障排查

| 问题 | 处理 |
|------|------|
| App 打开后「无法连接 API」 | 检查 `.env.production` 中 `VITE_API_BASE_URL` 是否正确，重新 `cap:sync` |
| 相机/相册无权限 | 系统设置 → 应用 → 美式证件照 → 权限 |
| 保存相册失败 | 确认已授予存储/相册权限；Android 13+ 需 `READ_MEDIA_IMAGES` |
| Gradle 同步失败 | Android Studio → SDK Manager 安装 API 34 |
| 下载页 404 | 确认 `public/download/index.html` 和 APK 已部署到 `dist/download/` |

---

## 11. 安全提示

- **不要**将 API Key 写入 APK；继续通过 Cloudflare Functions 服务端调用
- 公开 APK 意味着 API 可被调用，建议在 Cloudflare 侧加 **速率限制**
- 侧载 APK 可能被部分杀毒软件误报，使用正式签名可减轻
