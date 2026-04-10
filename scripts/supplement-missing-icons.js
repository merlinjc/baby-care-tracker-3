/**
 * 补充缺失图标脚本
 * 
 * 仅下载2个真正缺失的图标：
 * 1. times-circle - 错误状态图标
 * 2. copy - 复制功能图标
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// ============================================
// 配置部分
// ============================================

/**
 * 美拉德色系
 */
const COLOR_PALETTE = {
  error: '#D47B6A',      // 柔和红 - 错误状态
  neutral: '#2C3E50',    // 深灰 - 中性功能色
};

/**
 * 需要补充的图标
 */
const MISSING_ICONS = [
  {
    name: 'circle-xmark',  // FontAwesome 6 的实际名称
    saveAs: 'times-circle', // 保存为的名称
    category: 'status',
    color: COLOR_PALETTE.error,
    desc: '错误状态'
  },
  {
    name: 'copy',          // FontAwesome 6 的实际名称
    saveAs: 'copy',        // 保存为的名称
    category: 'navigation',
    color: COLOR_PALETTE.neutral,
    desc: '复制功能'
  }
];

/**
 * FontAwesome SVG 下载 URL
 */
const FA_BASE_URL = 'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid';

/**
 * 尺寸配置
 */
const SIZES = {
  '@2x': 48,
  '@3x': 72
};

// ============================================
// 工具函数
// ============================================

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function colorizeSvg(svgContent, color) {
  const rgb = hexToRgb(color);
  if (!rgb) return svgContent;
  
  let modifiedSvg = svgContent.replace(/fill="[^"]*"/g, `fill="${color}"`);
  
  if (!modifiedSvg.includes('fill=')) {
    modifiedSvg = modifiedSvg.replace('<svg', `<svg fill="${color}"`);
  }
  
  return modifiedSvg;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function downloadIcon(iconConfig) {
  const { name, saveAs, category, color, desc } = iconConfig;
  const svgUrl = `${FA_BASE_URL}/${name}.svg`;
  const outputDir = path.join(__dirname, '../miniprogram/images/icons', category);
  
  ensureDirectoryExists(outputDir);
  
  try {
    console.log(`下载图标: ${name} → ${saveAs} [${category}] - ${desc}`);
    
    // 下载 SVG
    const response = await axios.get(svgUrl, { responseType: 'text' });
    let svgContent = response.data;
    
    // 修改颜色
    svgContent = colorizeSvg(svgContent, color);
    
    // 保存 SVG 文件
    const svgPath = path.join(outputDir, `${saveAs}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    
    // 转换为 @2x 和 @3x PNG
    for (const [scale, size] of Object.entries(SIZES)) {
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toBuffer();
      
      const pngPath = path.join(outputDir, `${saveAs}${scale}.png`);
      fs.writeFileSync(pngPath, pngBuffer);
      console.log(`  ✓ 生成: ${saveAs}${scale}.png (${size}x${size})`);
    }
    
    return {
      success: true,
      name: saveAs,
      category,
      color,
      desc
    };
  } catch (error) {
    console.error(`  ✗ 下载失败: ${name} - ${error.message}`);
    return {
      success: false,
      name: saveAs,
      error: error.message
    };
  }
}

// ============================================
// 主执行函数
// ============================================

async function main() {
  console.log('========================================');
  console.log('补充缺失图标');
  console.log('========================================\n');
  
  console.log('📋 待下载图标:\n');
  MISSING_ICONS.forEach((icon, index) => {
    console.log(`${index + 1}. ${icon.saveAs} (${icon.category}) - ${icon.desc}`);
    console.log(`   颜色: ${icon.color}`);
  });
  console.log('\n----------------------------------------\n');
  
  const results = [];
  
  for (const iconConfig of MISSING_ICONS) {
    const result = await downloadIcon(iconConfig);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n========================================');
  console.log('✨ 图标补充完成！');
  console.log(`✅ 成功: ${successCount}/${MISSING_ICONS.length}`);
  console.log(`❌ 失败: ${failCount}/${MISSING_ICONS.length}`);
  console.log('========================================\n');
  
  // 更新配置文件
  if (successCount > 0) {
    console.log('📌 图标已保存到：');
    results.filter(r => r.success).forEach(result => {
      console.log(`   - miniprogram/images/icons/${result.category}/${result.name}@2x.png`);
      console.log(`   - miniprogram/images/icons/${result.category}/${result.name}@3x.png`);
    });
    console.log('\n✅ 所有图标资源已准备就绪，可以开始阶段三的代码替换工作！\n');
  }
  
  // 如果有失败的，提供手动下载指南
  if (failCount > 0) {
    console.log('⚠️  以下图标需要手动下载：\n');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.name}: ${result.error}`);
    });
    console.log('\n请访问 https://fontawesome.com/icons 手动下载 SVG 文件\n');
  }
}

// 执行主函数
main().catch(console.error);
