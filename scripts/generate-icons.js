/**
 * 图标批量下载脚本
 * 使用 Iconify API 下载 SVG 并转换为 PNG
 * 
 * 使用方法：
 * node scripts/generate-icons.js
 * 
 * 依赖：
 * npm install sharp axios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ============================================
// 配置
// ============================================

const OUTPUT_DIR = path.join(__dirname, '../miniprogram/images/icons');
const OUTPUT_ROOT = path.join(__dirname, '../miniprogram/images');
const ICON_SIZE = 48; // 48x48px

// ============================================
// 美拉德色系配色方案
// ============================================

const COLORS = {
  // 通用图标 - 灰棕
  GENERAL: '#8B7B6B',
  
  // 功能色
  FEEDING: '#A8D4A8',   // 浅绿
  SLEEP: '#B8A8D4',     // 淡紫
  DIAPER: '#D4C8A8',    // 浅棕
  TEMPERATURE: '#D4A8A8', // 浅红
  
  // 白色变体
  WHITE: '#FFFFFF',
  
  // 状态色
  SUCCESS: '#7FB069',   // 柔和绿
  WARNING: '#E5A853',   // 暖橙
  ERROR: '#D47B6A',     // 柔和红
  INFO: '#7BA3C9',      // 柔和蓝
  
  // 强调色
  ACCENT: '#D4A574',    // 杏色
  
  // TabBar
  TABBAR_NORMAL: '#8B7B6B',
  TABBAR_ACTIVE: '#D4B896'
};

// ============================================
// 图标清单 - 完整定义所有需要的图标
// ============================================

const ICONS = [
  // ========== 通用操作图标 ==========
  { name: 'arrow-right', iconify: 'mdi:arrow-right', color: COLORS.GENERAL },
  { name: 'arrow-down-tray', iconify: 'mdi:download', color: COLORS.GENERAL },
  { name: 'chevron-up', iconify: 'mdi:chevron-up', color: COLORS.GENERAL },
  { name: 'chevron-down', iconify: 'mdi:chevron-down', color: COLORS.GENERAL },
  { name: 'chevron-right', iconify: 'mdi:chevron-right', color: COLORS.GENERAL },
  { name: 'close', iconify: 'mdi:close', color: COLORS.GENERAL },
  { name: 'x-mark', iconify: 'mdi:close-thick', color: COLORS.GENERAL },
  { name: 'plus', iconify: 'mdi:plus', color: COLORS.GENERAL },
  { name: 'check', iconify: 'mdi:check', color: COLORS.SUCCESS },
  { name: 'edit', iconify: 'mdi:pencil', color: COLORS.GENERAL },
  { name: 'edit-gray', iconify: 'mdi:pencil', color: COLORS.GENERAL },
  { name: 'trash-red', iconify: 'mdi:delete', color: COLORS.ERROR },
  { name: 'calendar', iconify: 'mdi:calendar', color: COLORS.GENERAL },
  { name: 'clock', iconify: 'mdi:clock-outline', color: COLORS.GENERAL },
  { name: 'magnifying-glass', iconify: 'mdi:magnify', color: COLORS.GENERAL },
  { name: 'funnel', iconify: 'mdi:filter-variant', color: COLORS.GENERAL },
  { name: 'share', iconify: 'mdi:share-variant', color: COLORS.GENERAL },
  { name: 'copy', iconify: 'mdi:content-copy', color: COLORS.GENERAL },
  { name: 'camera', iconify: 'mdi:camera', color: COLORS.GENERAL },
  { name: 'camera-white', iconify: 'mdi:camera', color: COLORS.WHITE },
  { name: 'image', iconify: 'mdi:image', color: COLORS.GENERAL },
  { name: 'swap', iconify: 'mdi:swap-horizontal', color: COLORS.GENERAL },
  { name: 'skip', iconify: 'mdi:skip-next', color: COLORS.GENERAL },
  { name: 'key', iconify: 'mdi:key', color: COLORS.GENERAL },
  { name: 'visible', iconify: 'mdi:eye', color: COLORS.GENERAL },
  { name: 'visible-gray', iconify: 'mdi:eye', color: COLORS.GENERAL },
  { name: 'info', iconify: 'mdi:information', color: COLORS.INFO },
  { name: 'book', iconify: 'mdi:book-open-variant', color: COLORS.GENERAL },
  
  // ========== 核心功能图标 ==========
  // 喂养
  { name: 'feeding', iconify: 'mdi:baby-bottle', color: COLORS.FEEDING },
  { name: 'feeding-color', iconify: 'mdi:baby-bottle', color: COLORS.FEEDING },
  { name: 'feeding-white', iconify: 'mdi:baby-bottle', color: COLORS.WHITE },
  
  // 睡眠
  { name: 'sleep', iconify: 'mdi:power-sleep', color: COLORS.SLEEP },
  { name: 'sleep-color', iconify: 'mdi:power-sleep', color: COLORS.SLEEP },
  { name: 'sleep-white', iconify: 'mdi:power-sleep', color: COLORS.WHITE },
  { name: 'sleep-blue', iconify: 'mdi:power-sleep', color: COLORS.INFO },
  
  // 排便
  { name: 'diaper', iconify: 'mdi:baby-carriage', color: COLORS.DIAPER },
  { name: 'diaper-color', iconify: 'mdi:baby-carriage', color: COLORS.DIAPER },
  { name: 'diaper-white', iconify: 'mdi:baby-carriage', color: COLORS.WHITE },
  
  // 体温/健康
  { name: 'temperature', iconify: 'mdi:thermometer', color: COLORS.TEMPERATURE },
  { name: 'temperature-white', iconify: 'mdi:thermometer', color: COLORS.WHITE },
  { name: 'health-color', iconify: 'mdi:heart-pulse', color: COLORS.TEMPERATURE },
  
  // 生长
  { name: 'growth', iconify: 'mdi:chart-line', color: COLORS.ACCENT },
  { name: 'growth-color', iconify: 'mdi:chart-line', color: COLORS.ACCENT },
  { name: 'growth-white', iconify: 'mdi:chart-line', color: COLORS.WHITE },
  { name: 'weight', iconify: 'mdi:scale-bathroom', color: COLORS.ACCENT },
  { name: 'height', iconify: 'mdi:human-male-height', color: COLORS.ACCENT },
  { name: 'head', iconify: 'mdi:head', color: COLORS.ACCENT },
  { name: 'bmi', iconify: 'mdi:chart-box', color: COLORS.ACCENT },
  
  // ========== 状态图标 ==========
  { name: 'check-circle', iconify: 'mdi:check-circle', color: COLORS.SUCCESS },
  { name: 'warning', iconify: 'mdi:alert', color: COLORS.WARNING },
  { name: 'warning-color', iconify: 'mdi:alert', color: COLORS.WARNING },
  { name: 'times-circle', iconify: 'mdi:close-circle', color: COLORS.ERROR },
  { name: 'error', iconify: 'mdi:alert-circle', color: COLORS.ERROR },
  { name: 'lightbulb', iconify: 'mdi:lightbulb', color: COLORS.INFO },
  { name: 'wifi', iconify: 'mdi:wifi', color: COLORS.INFO },
  { name: 'chart-line', iconify: 'mdi:chart-line', color: COLORS.INFO },
  { name: 'network', iconify: 'mdi:network-off', color: COLORS.ERROR },
  
  // ========== 用户/角色图标 ==========
  { name: 'baby', iconify: 'mdi:baby-face', color: COLORS.GENERAL },
  { name: 'baby-face', iconify: 'mdi:baby-face', color: COLORS.ACCENT },
  { name: 'boy', iconify: 'mdi:human-male-boy', color: COLORS.INFO },
  { name: 'girl', iconify: 'mdi:human-female-girl', color: COLORS.WARNING },
  { name: 'user', iconify: 'mdi:account', color: COLORS.GENERAL },
  { name: 'users', iconify: 'mdi:account-group', color: COLORS.GENERAL },
  { name: 'family', iconify: 'mdi:account-group', color: COLORS.ACCENT },
  { name: 'family-gray', iconify: 'mdi:account-group', color: COLORS.GENERAL },
  { name: 'add-family', iconify: 'mdi:account-plus', color: COLORS.ACCENT },
  { name: 'join-family', iconify: 'mdi:account-arrow-right', color: COLORS.ACCENT },
  
  // 角色图标 - 需要后续AI生成，这里先用通用图标占位
  { name: 'mom', iconify: 'mdi:face-woman', color: COLORS.ACCENT },
  { name: 'dad', iconify: 'mdi:face-man', color: COLORS.ACCENT },
  { name: 'grandma', iconify: 'mdi:face-woman', color: COLORS.ACCENT },
  { name: 'grandpa', iconify: 'mdi:face-man', color: COLORS.ACCENT },
  { name: 'nanny', iconify: 'mdi:face-woman', color: COLORS.ACCENT },
  
  // ========== 功能/页面图标 ==========
  { name: 'compass', iconify: 'mdi:compass', color: COLORS.ACCENT },
  { name: 'robot', iconify: 'mdi:robot', color: COLORS.ACCENT },
  { name: 'rocket', iconify: 'mdi:rocket-launch', color: COLORS.ACCENT },
  { name: 'rocket-red', iconify: 'mdi:rocket-launch', color: COLORS.ERROR },
  { name: 'vaccine-color', iconify: 'mdi:needle', color: COLORS.ACCENT },
  { name: 'milestone-color', iconify: 'mdi:flag', color: COLORS.ACCENT },
  { name: 'ai-assistant', iconify: 'mdi:robot-outline', color: COLORS.ACCENT },
  { name: 'syringe', iconify: 'mdi:needle', color: COLORS.TEMPERATURE },
  { name: 'settings', iconify: 'mdi:cog', color: COLORS.GENERAL },
  { name: 'clipboard-list', iconify: 'mdi:clipboard-list', color: COLORS.GENERAL },
  { name: 'bullseye', iconify: 'mdi:target', color: COLORS.ACCENT },
  
  // ========== 发育领域图标 ==========
  { name: 'running', iconify: 'mdi:run', color: COLORS.ACCENT },
  { name: 'hand', iconify: 'mdi:hand-back-right', color: COLORS.ACCENT },
  { name: 'comments', iconify: 'mdi:comment-text', color: COLORS.ACCENT },
  { name: 'brain', iconify: 'mdi:brain', color: COLORS.ACCENT },
  
  // ========== 其他 ==========
  { name: 'add-white', iconify: 'mdi:plus', color: COLORS.WHITE },
  { name: 'share-white', iconify: 'mdi:share-variant', color: COLORS.WHITE },
  { name: 'share-invite', iconify: 'mdi:share-variant', color: COLORS.ACCENT },
];

// TabBar 图标
const TABBAR_ICONS = [
  { name: 'tab-home', iconify: 'mdi:home', color: COLORS.TABBAR_NORMAL },
  { name: 'tab-home-active', iconify: 'mdi:home', color: COLORS.TABBAR_ACTIVE },
  { name: 'tab-record', iconify: 'mdi:plus-circle', color: COLORS.TABBAR_NORMAL },
  { name: 'tab-record-active', iconify: 'mdi:plus-circle', color: COLORS.TABBAR_ACTIVE },
  { name: 'tab-discover', iconify: 'mdi:compass', color: COLORS.TABBAR_NORMAL },
  { name: 'tab-discover-active', iconify: 'mdi:compass', color: COLORS.TABBAR_ACTIVE },
  { name: 'tab-profile', iconify: 'mdi:account', color: COLORS.TABBAR_NORMAL },
  { name: 'tab-profile-active', iconify: 'mdi:account', color: COLORS.TABBAR_ACTIVE },
];

// Popup 弹窗图标
const POPUP_ICONS = [
  // 喂养方式
  { name: 'feeding-bottle', iconify: 'mdi:baby-bottle', color: COLORS.FEEDING },
  { name: 'feeding-meal', iconify: 'mdi:food-apple', color: COLORS.FEEDING },
  
  // 睡眠类型
  { name: 'sleep-auto', iconify: 'mdi:power-sleep', color: COLORS.SLEEP },
  { name: 'sleep-night', iconify: 'mdi:weather-night', color: COLORS.SLEEP },
  { name: 'sleep-nap', iconify: 'mdi:power-sleep', color: COLORS.SLEEP },
  
  // 排便类型
  { name: 'diaper-pee', iconify: 'mdi:water', color: COLORS.DIAPER },
  { name: 'diaper-poop', iconify: 'mdi:emoticon-poop', color: COLORS.DIAPER },
  { name: 'diaper-both', iconify: 'mdi:water-plus', color: COLORS.DIAPER },
  
  // 体温测量方式
  { name: 'temperature-thermometer', iconify: 'mdi:thermometer', color: COLORS.TEMPERATURE },
  { name: 'temperature-ear', iconify: 'mdi:ear-hearing', color: COLORS.TEMPERATURE },
  { name: 'temperature-forehead', iconify: 'mdi:thermometer', color: COLORS.TEMPERATURE },
];

// ============================================
// 工具函数
// ============================================

/**
 * 从 Iconify API 下载 SVG
 */
async function downloadSVG(iconifyId, color) {
  const [set, name] = iconifyId.split(':');
  const url = `https://api.iconify.design/${set}/${name}.svg?color=${encodeURIComponent(color)}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    throw new Error(`下载失败 ${iconifyId}: ${error.message}`);
  }
}

/**
 * 将 SVG 转换为 PNG
 */
async function svgToPNG(svgContent, outputPath, size = ICON_SIZE) {
  try {
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    throw new Error(`PNG转换失败: ${error.message}`);
  }
}

/**
 * 处理单个图标
 */
async function processIcon(icon, outputDir, logPrefix = '') {
  const outputPath = path.join(outputDir, `${icon.name}.png`);
  
  // 检查文件是否已存在
  if (fs.existsSync(outputPath)) {
    console.log(`${logPrefix}⏭️  已存在: ${icon.name}.png`);
    return { success: true, skipped: true };
  }
  
  try {
    // 下载 SVG
    const svg = await downloadSVG(icon.iconify, icon.color);
    
    // 转换为 PNG
    await svgToPNG(svg, outputPath);
    
    console.log(`${logPrefix}✅ 成功: ${icon.name}.png`);
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`${logPrefix}❌ 失败: ${icon.name}.png - ${error.message}`);
    return { success: false, skipped: false, error: error.message };
  }
}

/**
 * 批量处理图标
 */
async function processIcons(icons, outputDir, category = '') {
  const results = {
    total: icons.length,
    success: 0,
    failed: 0,
    skipped: 0
  };
  
  const logPrefix = category ? `[${category}] ` : '';
  
  console.log(`\n${logPrefix}开始处理 ${icons.length} 个图标...`);
  
  for (const icon of icons) {
    const result = await processIcon(icon, outputDir, logPrefix);
    
    if (result.skipped) {
      results.skipped++;
    } else if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n${logPrefix}处理完成:`);
  console.log(`${logPrefix}  ✅ 成功: ${results.success}`);
  console.log(`${logPrefix}  ⏭️  跳过: ${results.skipped}`);
  console.log(`${logPrefix}  ❌ 失败: ${results.failed}`);
  
  return results;
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('🎨 图标生成脚本启动\n');
  console.log(`📁 输出目录: ${OUTPUT_DIR}\n`);
  
  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('✅ 创建 icons 目录');
  }
  
  const popupDir = path.join(OUTPUT_DIR, 'popup');
  if (!fs.existsSync(popupDir)) {
    fs.mkdirSync(popupDir, { recursive: true });
    console.log('✅ 创建 popup 目录');
  }
  
  // 处理各类图标
  const allResults = {
    general: await processIcons(ICONS, OUTPUT_DIR, '通用图标'),
    tabbar: await processIcons(TABBAR_ICONS, OUTPUT_ROOT, 'TabBar图标'),
    popup: await processIcons(POPUP_ICONS, popupDir, '弹窗图标'),
  };
  
  // 汇总结果
  console.log('\n========================================');
  console.log('📊 总体结果汇总');
  console.log('========================================');
  
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  
  for (const [category, results] of Object.entries(allResults)) {
    console.log(`\n${category}:`);
    console.log(`  成功: ${results.success} | 跳过: ${results.skipped} | 失败: ${results.failed}`);
    totalSuccess += results.success;
    totalFailed += results.failed;
    totalSkipped += results.skipped;
  }
  
  console.log('\n----------------------------------------');
  console.log(`总计:`);
  console.log(`  ✅ 成功: ${totalSuccess}`);
  console.log(`  ⏭️  跳过: ${totalSkipped}`);
  console.log(`  ❌ 失败: ${totalFailed}`);
  console.log('========================================\n');
  
  if (totalFailed > 0) {
    console.log('⚠️  部分图标下载失败，请检查网络连接或手动下载');
    process.exit(1);
  } else {
    console.log('🎉 所有图标生成完成！');
    process.exit(0);
  }
}

// 执行
main().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});
