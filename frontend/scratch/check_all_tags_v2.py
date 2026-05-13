import re

def check_all_tags_v2(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Match any opening or closing tag
    pattern = re.compile(r'<(/?)([a-zA-Z0-9]+)(\s+[^>]*?)?>', re.DOTALL)
    
    stack = []
    
    # Tags to ignore for balance
    void_tags = {'img', 'br', 'hr', 'input', 'link', 'meta', 'Area', 'XAxis', 'YAxis', 'Tooltip', 'ReferenceLine', 'ReferenceArea', 'CartesianGrid', 'Legend', 'ResponsiveContainer', 'AreaChart', 'stop', 'linearGradient', 'defs', 'line', 'rect', 'circle', 'path', 'Bot', 'MessageSquare', 'TrendingUp', 'TrendingDown', 'Bookmark', 'Share2', 'Calendar', 'Download', 'Trophy', 'ArrowUpRight', 'ShieldCheck', 'Zap', 'Users', 'Activity', 'Layout', 'ChevronRight', 'Clock', 'Search', 'Bell', 'MoreHorizontal', 'Filter', 'Plus', 'Check', 'AlertCircle', 'ExternalLink', 'Info', 'Menu', 'X', 'Side', 'OrderType', 'ChartMode', 'Range', 'typeof', 'ApiPricePoint', 'ApiMarket', 'ApiAgent', 'ApiComment', 'OBRow', 'Candle', 'ApiPricePoint', 'any', 'boolean', 'string', 'number', 'Side', 'OrderType', 'ChartMode', 'Range', 'React'}
    
    for match in pattern.finditer(content):
        full_tag = match.group(0)
        is_closing = match.group(1) == '/'
        tag_name = match.group(2)
        line_num = content.count('\n', 0, match.start()) + 1
        
        if full_tag.strip().endswith('/>'):
            continue
            
        if tag_name in void_tags and not is_closing:
            continue
            
        if not is_closing:
            stack.append((tag_name, line_num))
        else:
            if not stack:
                print(f"[{line_num}] Extra closing tag: {full_tag.strip()}")
            else:
                last_name, last_line = stack.pop()
                if last_name != tag_name:
                    print(f"[{line_num}] Mismatched tag: expected </{last_name}> (from line {last_line}), but found {full_tag.strip()}")

    while stack:
        name, line = stack.pop()
        print(f"UNCLOSED: <{name}> from line {line}")

if __name__ == "__main__":
    check_all_tags_v2('src/pages/MarketDetail.tsx')
