/**
 * 手动下载图标处理脚本
 * 
 * 用于处理从 FontAwesome 官网手动下载的 SVG 图标
 * 自动着色并转换为 PNG @2x/@3x
 * 
 * 使用方法：
 * 1. 从 FontAwesome 官网下载 SVG 文件
 * 2. 保存到 miniprogram/images/icons/manual/ 目录
 * 3. 运行：node scripts/process-manual-icons.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ============================================
// 配置部分
// ============================================

/**
 * 手动下载图标的配置
 */
const MANUAL_ICONS_CONFIG = [
  {
    name: 'thermometer-half',
    category: 'functional',
    color: '#98FB98',
    desc: '体温记录'
  },
  {
    name: 'running',
    category: 'milestone',
    color: '#FFDAB9',
    desc: '大运动'
  },
  {
    name: 'hand-paper',
    category: 'milestone',
    color: '#FFB6C1',
    desc: '精细动作'
  },
  {
    name: 'check-circle',
    category: 'status',
    color: '#98FB98',
    desc: '成功/正常'
  },
  {
    name: 'exclamation-triangle',
    category: 'status',
    color: '#FFFACD',
    desc: '警告/需关注'
  },
  {
    name: 'times-circle',
    category: 'status',
    color: '#FFB6C1',
    desc: '错误状态'
  }
];

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

/**
 * 颜色转换为 RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * 修改 SVG 颜色
 */
function colorizeSvg(svgContent, color) {
  const rgb = hexToRgb(color);
  if (!rgb) return svgContent;
  
  // 替换 fill 属性或添加 fill 属性
  let modifiedSvg = svgContent.replace(/fill="[^"]*"/g, `fill="${color}"`);
  
  // 如果没有 fill 属性，添加一个
  if (!modifiedSvg.includes('fill=')) {
    modifiedSvg = modifiedSvg.replace('<svg', `<svg fill="${color}"`);
  }
  
  return modifiedSvg;
}

/**
 * 创建目录
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 处理单个图标
 */
async function processIcon(config) {
  const { name, category, color, desc } = config;
  
  // 源文件路径（手动下载的 SVG）
  const manualDir = path.join(__dirname, '../miniprogram/images/icons/manual');
  const svgPath = path.join(manualDir, `${name}.svg`);
  
  // 目标目录
  const targetDir = path.join(__dirname, '../miniprogram/images/icons', category);
  ensureDirectoryExists(targetDir);
  
  if (!fs.existsSync(svgPath)) {
    console.log(`⚠️  未找到: ${name}.svg (请先从 FontAwesome 下载)`);
    return { success: false, name, reason: 'file_not_found' };
  }
  
  try {
    console.log(`处理图标: ${name} [${category}] - ${desc}`);
    
    // 读取 SVG 内容
    let svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // 修改颜色
    svgContent = colorizeSvg(svgContent, color);
    
    // 保存处理后的 SVG
    const targetSvgPath = path.join(targetDir, `${name}.svg`);
    fs.writeFileSync(targetSvgPath, svgContent);
    
    // 转换为 PNG
    for (const [scale, size] of Object.entries(SIZES)) {
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toBuffer();
      
      const pngPath = path.join(targetDir, `${name}${scale}.png`);
      fs.writeFileSync(pngPath, pngBuffer);
      console.log(`  ✓ 生成: ${name}${scale}.png (${size}x${size})`);
    }
    
    return { success: true, name, category, color, desc };
    
  } catch (error) {
    console.error(`  ✗ 处理失败: ${name} - ${error.message}`);
    return { success: false, name, reason: error.message };
  }
}

// ============================================
// 主执行函数
// ============================================

async function main() {
  console.log('========================================');
  console.log('手动图标处理工具');
  console.log('========================================\n');
  
  // 检查 manual 目录是否存在
  const manualDir = path.join(__dirname, '../miniprogram/images/icons/manual');
  ensureDirectoryExists(manualDir);
  
  console.log('📁 手动下载目录: miniprogram/images/icons/manual/\n');
  console.log('📋 待处理图标:\n');
  
  MANUAL_ICONS_CONFIG.forEach((config, index) => {
    console.log(`${index + 1}. ${config.name} (${config.category}) - ${config.desc}`);
  });
  
  console.log('\n----------------------------------------\n');
  
  const results = [];
  
  for (const config of MANUAL_ICONS_CONFIG) {
    const result = await processIcon(config);
    results.push(result);
  }
  
  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n========================================');
  console.log('处理完成！');
  console.log(`✅ 成功: ${successCount}/${MANUAL_ICONS_CONFIG.length}`);
  console.log(`❌ 失败: ${failCount}/${MANUAL_ICONS_CONFIG.length}`);
  console.log('========================================\n');
  
  // 显示失败原因
  if (failCount > 0) {
    console.log('⚠️  失败图标:\n');
    results.filter(r => !r.success).forEach(result => {
      console.log(`- ${result.name}: ${result.reason}`);
    });
    console.log('\n请查看 specs/icon-replacement/manual-download-guide.md 获取下载指南\n');
  }
  
  // 更新配置文件
  if (successCount > 0) {
    updateIconsConfig(results.filter(r => r.success));
  }
}

/**
 * 更新图标配置文件
 */
function updateIconsConfig(newIcons) {
  const configPath = path.join(__dirname, '../miniprogram/config/icons.js');
  
  if (!fs.existsSync(configPath)) {
    console.log('⚠️  配置文件不存在，请先运行 prepare-icon-resources.js');
    return;
  }
  
  // 读取现有配置
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  // 这里可以添加逻辑来更新配置文件
  // 为了简化，我们只输出提示
  console.log('💡 提示: 图标已处理完成，配置文件需要手动更新或重新运行 prepare-icon-resources.js\n');
}

// 执行主函数
main().catch(console.error);
