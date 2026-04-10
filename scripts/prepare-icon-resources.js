/**
 * FontAwesome 图标资源准备脚本
 * 
 * 功能：
 * 1. 批量下载 FontAwesome 6 免费图标（SVG格式）
 * 2. 根据色彩系统为图标上色
 * 3. 导出 PNG 格式（@2x/@3x）
 * 4. 生成图标配置清单
 * 
 * 使用方法：
 * node scripts/prepare-icon-resources.js
 * 
 * 依赖：
 * npm install axios sharp
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// ============================================
// 色彩系统定义（来自实施方案）
// ============================================

const COLOR_SYSTEM = {
  // 功能分类色彩
  functional: {
    feeding: '#FFB6C1',     // 柔和粉 - 喂养
    sleep: '#87CEEB',       // 柔和蓝 - 睡眠
    diaper: '#D2B48C',      // 浅棕 - 排便
    health: '#98FB98',      // 清新绿 - 健康
    growth: '#FFFACD',      // 柔和黄 - 生长
    family: '#FFB6C1',      // 柔和粉 - 家庭
    ai: '#87CEEB',          // 柔和蓝 - AI
  },
  
  // 状态指示色彩
  status: {
    success: '#98FB98',     // 柔和绿 - 成功
    warning: '#FFFACD',     // 柔和黄 - 警告
    error: '#FFB6C1',       // 柔和红 - 错误
    info: '#87CEEB',        // 柔和蓝 - 信息
  },
  
  // 中性色
  neutral: {
    dark: '#2C3E50',        // 深灰 - 文字/导航
  }
};

// ============================================
// 图标清单（来自实施方案）
// ============================================

const ICON_LIST = {
  // 功能图标（9个）
  functional: [
    { name: 'bottle-water', color: COLOR_SYSTEM.functional.feeding, desc: '喂养记录' },
    { name: 'moon', color: COLOR_SYSTEM.functional.sleep, desc: '睡眠记录' },
    { name: 'baby', color: COLOR_SYSTEM.functional.diaper, desc: '排便记录' },
    { name: 'thermometer-half', color: COLOR_SYSTEM.functional.health, desc: '体温记录' },
    { name: 'syringe', color: COLOR_SYSTEM.functional.health, desc: '疫苗接种' },
    { name: 'rocket', color: COLOR_SYSTEM.functional.growth, desc: '快速开始' },
    { name: 'clipboard-list', color: COLOR_SYSTEM.functional.growth, desc: '日常记录' },
    { name: 'robot', color: COLOR_SYSTEM.functional.ai, desc: 'AI助手' },
    { name: 'users', color: COLOR_SYSTEM.functional.family, desc: '家庭协作' }
  ],
  
  // 发育领域图标（5个）
  milestone: [
    { name: 'running', color: '#FFDAB9', desc: '大运动' },
    { name: 'hand-paper', color: '#FFB6C1', desc: '精细动作' },
    { name: 'comments', color: '#87CEEB', desc: '语言' },
    { name: 'baby', color: '#FFB6C1', desc: '社交' },
    { name: 'brain', color: '#98FB98', desc: '认知' }
  ],
  
  // 状态图标（6个）
  status: [
    { name: 'check-circle', color: COLOR_SYSTEM.status.success, desc: '成功/正常' },
    { name: 'exclamation-triangle', color: COLOR_SYSTEM.status.warning, desc: '警告/需关注' },
    { name: 'times-circle', color: COLOR_SYSTEM.status.error, desc: '错误状态' },
    { name: 'wifi', color: COLOR_SYSTEM.status.info, desc: '网络状态' },
    { name: 'chart-line', color: COLOR_SYSTEM.status.info, desc: '图表分析' },
    { name: 'lightbulb', color: COLOR_SYSTEM.status.warning, desc: '提示信息' }
  ],
  
  // 导航图标（3个）
  navigation: [
    { name: 'clipboard-list', color: COLOR_SYSTEM.neutral.dark, desc: '列表/记录' },
    { name: 'link', color: COLOR_SYSTEM.neutral.dark, desc: '链接/分享' },
    { name: 'bullseye', color: '#FFDAB9', desc: '目标/关注' }
  ]
};

// ============================================
// 尺寸配置
// ============================================

const SIZES = {
  xs: 16,    // 装饰图标
  sm: 20,    // 列表项图标
  md: 24,    // 导航栏/功能按钮
  lg: 32,    // TabBar图标
  xl: 48,    // 空状态/大图标
  xxl: 64    // 特大图标
};

// ============================================
// FontAwesome SVG 下载配置
// ============================================

const FA_BASE_URL = 'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid';

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
 * 下载 SVG 图标
 */
async function downloadIcon(iconName, category, color, desc) {
  const svgUrl = `${FA_BASE_URL}/${iconName}.svg`;
  const outputDir = path.join(__dirname, '../miniprogram/images/icons', category);
  
  ensureDirectoryExists(outputDir);
  
  try {
    console.log(`下载图标: ${iconName} [${category}] - ${desc}`);
    
    // 下载 SVG
    const response = await axios.get(svgUrl, { responseType: 'text' });
    let svgContent = response.data;
    
    // 修改颜色
    svgContent = colorizeSvg(svgContent, color);
    
    // 保存 SVG 文件
    const svgPath = path.join(outputDir, `${iconName}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    
    // 转换为 @2x 和 @3x PNG
    const baseSize = SIZES.md; // 基准尺寸 24px
    
    // @2x (48px)
    const png2xBuffer = await sharp(Buffer.from(svgContent))
      .resize(baseSize * 2, baseSize * 2)
      .png()
      .toBuffer();
    
    const png2xPath = path.join(outputDir, `${iconName}@2x.png`);
    fs.writeFileSync(png2xPath, png2xBuffer);
    console.log(`  ✓ 生成: ${iconName}@2x.png (${baseSize * 2}x${baseSize * 2})`);
    
    // @3x (72px)
    const png3xBuffer = await sharp(Buffer.from(svgContent))
      .resize(baseSize * 3, baseSize * 3)
      .png()
      .toBuffer();
    
    const png3xPath = path.join(outputDir, `${iconName}@3x.png`);
    fs.writeFileSync(png3xPath, png3xBuffer);
    console.log(`  ✓ 生成: ${iconName}@3x.png (${baseSize * 3}x${baseSize * 3})`);
    
    return {
      success: true,
      name: iconName,
      category,
      color,
      desc,
      sizes: ['@2x', '@3x']
    };
  } catch (error) {
    console.error(`  ✗ 下载失败: ${iconName} - ${error.message}`);
    return {
      success: false,
      name: iconName,
      category,
      error: error.message
    };
  }
}

/**
 * 生成图标配置文件 config/icons.js
 */
function generateIconsConfig(results) {
  const config = {
    version: '1.0.0',
    colorSystem: COLOR_SYSTEM,
    sizes: SIZES,
    categories: {}
  };
  
  // 按分类组织图标
  const categoryMap = {
    functional: '功能图标',
    milestone: '发育领域图标',
    status: '状态图标',
    navigation: '导航图标'
  };
  
  for (const [category, label] of Object.entries(categoryMap)) {
    const categoryIcons = results.filter(r => r.category === category && r.success);
    config.categories[category] = {
      label,
      count: categoryIcons.length,
      icons: categoryIcons.map(icon => ({
        name: icon.name,
        color: icon.color,
        desc: icon.desc,
        path: `/images/icons/${category}/${icon.name}`
      }))
    };
  }
  
  // 生成 JavaScript 配置文件
  const jsContent = `/**
 * 图标配置文件
 * 自动生成 - 请勿手动修改
 * 
 * 生成时间: ${new Date().toISOString()}
 * 图标总数: ${results.filter(r => r.success).length}
 */

const IconsConfig = ${JSON.stringify(config, null, 2)};

/**
 * 获取图标路径
 * @param {string} category - 分类名称
 * @param {string} name - 图标名称
 * @param {string} scale - 缩放比例 ('@2x' | '@3x')
 * @returns {string} 图标完整路径
 */
function getIconPath(category, name, scale = '@2x') {
  const icon = IconsConfig.categories[category]?.icons.find(i => i.name === name);
  if (!icon) {
    console.warn(\`图标未找到: \${category}/\${name}\`);
    return '';
  }
  return \`\${icon.path}\${scale}.png\`;
}

/**
 * 获取功能图标
 */
function getFunctionalIcon(name, scale = '@2x') {
  return getIconPath('functional', name, scale);
}

/**
 * 获取发育领域图标
 */
function getMilestoneIcon(name, scale = '@2x') {
  return getIconPath('milestone', name, scale);
}

/**
 * 获取状态图标
 */
function getStatusIcon(name, scale = '@2x') {
  return getIconPath('status', name, scale);
}

/**
 * 获取导航图标
 */
function getNavigationIcon(name, scale = '@2x') {
  return getIconPath('navigation', name, scale);
}

module.exports = {
  IconsConfig,
  getIconPath,
  getFunctionalIcon,
  getMilestoneIcon,
  getStatusIcon,
  getNavigationIcon
};
`;

  const configPath = path.join(__dirname, '../miniprogram/config/icons.js');
  ensureDirectoryExists(path.dirname(configPath));
  fs.writeFileSync(configPath, jsContent);
  console.log('\n✓ 图标配置文件已生成: config/icons.js');
  
  return config;
}

/**
 * 生成资源清单 Markdown 文档
 */
function generateManifestDoc(results) {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  let markdown = `# 图标资源清单

## 概览

- **生成时间**: ${new Date().toLocaleString('zh-CN')}
- **总图标数**: ${results.length}
- **成功下载**: ${successCount}
- **下载失败**: ${failCount}

## 色彩系统

### 功能分类色彩
| 功能 | 颜色值 | 色彩名称 |
|------|--------|----------|
| 喂养 | ${COLOR_SYSTEM.functional.feeding} | 柔和粉 |
| 睡眠 | ${COLOR_SYSTEM.functional.sleep} | 柔和蓝 |
| 排便 | ${COLOR_SYSTEM.functional.diaper} | 浅棕 |
| 健康 | ${COLOR_SYSTEM.functional.health} | 清新绿 |
| 生长 | ${COLOR_SYSTEM.functional.growth} | 柔和黄 |

### 状态指示色彩
| 状态 | 颜色值 | 色彩名称 |
|------|--------|----------|
| 成功 | ${COLOR_SYSTEM.status.success} | 柔和绿 |
| 警告 | ${COLOR_SYSTEM.status.warning} | 柔和黄 |
| 错误 | ${COLOR_SYSTEM.status.error} | 柔和红 |
| 信息 | ${COLOR_SYSTEM.status.info} | 柔和蓝 |

## 图标列表

`;

  const categoryLabels = {
    functional: '功能图标',
    milestone: '发育领域图标',
    status: '状态图标',
    navigation: '导航图标'
  };
  
  for (const [category, label] of Object.entries(categoryLabels)) {
    const categoryIcons = results.filter(r => r.category === category);
    markdown += `### ${label}\n\n`;
    markdown += '| 图标名称 | 颜色 | 说明 | 状态 |\n';
    markdown += '|---------|------|------|------|\n';
    
    for (const icon of categoryIcons) {
      const status = icon.success ? '✅' : '❌';
      markdown += `| ${icon.name} | ${icon.color} | ${icon.desc} | ${status} |\n`;
    }
    markdown += '\n';
  }
  
  if (failCount > 0) {
    markdown += `## ⚠️ 失败图标处理\n\n`;
    markdown += `以下图标需要手动下载：\n\n`;
    
    const failedIcons = results.filter(r => !r.success);
    for (const icon of failedIcons) {
      markdown += `- **${icon.name}** (${icon.category}): ${icon.error}\n`;
    }
    
    markdown += `\n### 手动下载步骤\n\n`;
    markdown += `1. 访问 [FontAwesome 官网](https://fontawesome.com/icons)\n`;
    markdown += `2. 搜索对应图标名称\n`;
    markdown += `3. 下载 SVG 格式文件\n`;
    markdown += `4. 使用工具转换为 PNG @2x/@3x\n`;
    markdown += `5. 保存到 \`miniprogram/images/icons/${failedIcons[0]?.category}/\` 目录\n`;
  }
  
  const manifestPath = path.join(__dirname, '../specs/icon-replacement/resource-manifest.md');
  fs.writeFileSync(manifestPath, markdown);
  console.log('✓ 资源清单文档已生成: specs/icon-replacement/resource-manifest.md');
}

// ============================================
// 主执行函数
// ============================================

async function main() {
  console.log('========================================');
  console.log('FontAwesome 图标资源准备工具');
  console.log('========================================\n');
  
  console.log('📋 任务清单:');
  console.log('- 功能图标: 9个');
  console.log('- 发育领域图标: 5个');
  console.log('- 状态图标: 6个');
  console.log('- 导航图标: 3个');
  console.log('  总计: 23个图标\n');
  
  console.log('🎨 色彩系统: 柔和/粉彩风格\n');
  
  const results = [];
  let totalIcons = 0;
  
  // 按分类下载图标
  for (const [category, icons] of Object.entries(ICON_LIST)) {
    console.log(`\n[${category}] 分类:`);
    
    for (const icon of icons) {
      totalIcons++;
      const result = await downloadIcon(icon.name, category, icon.color, icon.desc);
      results.push(result);
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // 生成配置文件
  generateIconsConfig(results);
  
  // 生成资源清单文档
  generateManifestDoc(results);
  
  // 输出统计信息
  const successCount = results.filter(r => r.success).length;
  console.log('\n========================================');
  console.log('✨ 资源准备完成！');
  console.log(`✅ 成功: ${successCount}/${totalIcons}`);
  console.log(`❌ 失败: ${totalIcons - successCount}/${totalIcons}`);
  console.log('========================================\n');
  
  // 显示下一步操作
  console.log('📌 下一步操作：');
  console.log('1. 检查 miniprogram/images/icons/ 目录中的图标文件');
  console.log('2. 查看资源清单: specs/icon-replacement/resource-manifest.md');
  console.log('3. 如有下载失败的图标，请手动下载');
  console.log('4. 使用 config/icons.js 配置文件在代码中引用图标');
  console.log('5. 开始阶段二：组件改造工作\n');
}

// 执行主函数
main().catch(console.error);
