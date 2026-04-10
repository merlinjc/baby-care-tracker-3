/**
 * 彩蛋图标批量下载脚本
 * 使用 Iconify API 下载 SVG 并转换为 PNG
 * 
 * 使用方法：
 * node scripts/generate-easter-egg-icons.js
 * 
 * 依赖（已有）：
 * npm install sharp axios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ============================================
// 配置
// ============================================

const OUTPUT_DIR = path.join(__dirname, '../miniprogram/images/icons/easter-egg');
const ICON_SIZE = 48; // 48x48px，与项目一致

// ============================================
// 美拉德色系（与 generate-icons.js 保持一致）
// ============================================

const COLORS = {
  GENERAL: '#8B7B6B',    // 灰棕
  ACCENT: '#D4A574',     // 杏色（美拉德主强调色）
  PRIMARY: '#D4B896',    // 主色（金色暖调）
  WARNING: '#E5A853',    // 暖橙
  ERROR: '#D47B6A',      // 柔和红
  SUCCESS: '#7FB069',    // 柔和绿
  INFO: '#7BA3C9',       // 柔和蓝
  FESTIVAL_RED: '#D47B6A', // 节日红（柔和红，用于春节）
};

// ============================================
// 彩蛋图标清单
// ============================================

const EASTER_EGG_ICONS = [
  // ========== 时间节点彩蛋 ==========
  // EE-1: 满月 — 月亮图标
  { name: 'moon', iconify: 'mdi:moon-waning-crescent', color: COLORS.PRIMARY },
  
  // EE-2: 百日 — 数字100由CSS实现，这里放祥云装饰图标
  { name: 'cloud-lucky', iconify: 'mdi:cloud', color: COLORS.PRIMARY },
  
  // EE-3: 周岁 — 蛋糕图标
  { name: 'cake', iconify: 'mdi:cake-variant', color: COLORS.ACCENT },
  
  // ========== 行为彩蛋 ==========
  // EE-4: 首次记录 — 复用已有 rocket.png（不需要下载）
  // EE-6: 连续记录 — 火焰图标
  { name: 'fire', iconify: 'mdi:fire', color: COLORS.WARNING },
  
  // ========== 月龄/通用 ==========
  // EE-5: 月龄提示条 — 气球图标
  { name: 'balloon', iconify: 'mdi:balloon', color: COLORS.ACCENT },
  
  // ========== 数据洞察 ==========
  // EE-8: 通用星星图标
  { name: 'star', iconify: 'mdi:star', color: COLORS.PRIMARY },
  
  // ========== 节日彩蛋 ==========
  // EE-7: 儿童节 — 气球（复用 balloon）
  // EE-7: 母亲节 — 康乃馨/花朵
  { name: 'flower', iconify: 'mdi:flower', color: COLORS.ERROR },
  
  // EE-7: 父亲节 — 领带
  { name: 'necktie', iconify: 'mdi:tie', color: COLORS.INFO },
  
  // EE-7: 春节 — 灯笼（使用 mingcute 图标集）
  { name: 'lantern', iconify: 'mingcute:lantern-fill', color: COLORS.FESTIVAL_RED },
  
  // EE-7: 中秋 — 月饼（用 cookie 近似）
  { name: 'mooncake', iconify: 'mdi:cookie', color: COLORS.PRIMARY },
];

// ============================================
// 工具函数（与 generate-icons.js 一致）
// ============================================

/**
 * 从 Iconify API 下载 SVG
 */
async function downloadSVG(iconifyId, color) {
  const [set, name] = iconifyId.split(':');
  const url = `https://api.iconify.design/${set}/${name}.svg?color=${encodeURIComponent(color)}`;
  
  try {
    const response = await axios.get(url, { timeout: 15000 });
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
async function processIcon(icon, outputDir) {
  const outputPath = path.join(outputDir, `${icon.name}.png`);
  
  // 检查文件是否已存在
  if (fs.existsSync(outputPath)) {
    console.log(`  ⏭️  已存在: ${icon.name}.png`);
    return { success: true, skipped: true };
  }
  
  try {
    // 下载 SVG
    const svg = await downloadSVG(icon.iconify, icon.color);
    
    // 转换为 PNG
    await svgToPNG(svg, outputPath);
    
    console.log(`  ✅ 成功: ${icon.name}.png (${icon.iconify})`);
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`  ❌ 失败: ${icon.name}.png - ${error.message}`);
    return { success: false, skipped: false, error: error.message };
  }
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('🥚 彩蛋图标生成脚本启动\n');
  console.log(`📁 输出目录: ${OUTPUT_DIR}\n`);
  
  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('✅ 创建 easter-egg 图标目录\n');
  }
  
  // 处理图标
  console.log(`开始处理 ${EASTER_EGG_ICONS.length} 个彩蛋图标...\n`);
  
  let success = 0, failed = 0, skipped = 0;
  const failedIcons = [];
  
  for (const icon of EASTER_EGG_ICONS) {
    const result = await processIcon(icon, OUTPUT_DIR);
    
    if (result.skipped) {
      skipped++;
    } else if (result.success) {
      success++;
    } else {
      failed++;
      failedIcons.push({ name: icon.name, iconify: icon.iconify, error: result.error });
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // 汇总结果
  console.log('\n========================================');
  console.log('📊 彩蛋图标生成结果');
  console.log('========================================');
  console.log(`  ✅ 成功: ${success}`);
  console.log(`  ⏭️  跳过: ${skipped}`);
  console.log(`  ❌ 失败: ${failed}`);
  
  if (failedIcons.length > 0) {
    console.log('\n⚠️  失败的图标:');
    failedIcons.forEach(icon => {
      console.log(`  - ${icon.name} (${icon.iconify}): ${icon.error}`);
    });
    console.log('\n💡 提示: 可以从 https://icon-sets.iconify.design/ 手动搜索并下载');
  }
  
  console.log('\n========================================');
  
  // 列出最终文件清单
  console.log('\n📋 图标文件清单:');
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => {
    const size = fs.statSync(path.join(OUTPUT_DIR, f)).size;
    console.log(`  ${f} (${(size / 1024).toFixed(1)}KB)`);
  });
  
  console.log(`\n💡 注意: EE-4（首次记录）复用已有图标 /images/icons/rocket.png，无需新增`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 所有彩蛋图标生成完成！');
    process.exit(0);
  }
}

// 执行
main().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});
