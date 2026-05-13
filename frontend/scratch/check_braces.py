def check_braces(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    lines = content.splitlines()
    
    for i, line in enumerate(lines):
        line_num = i + 1
        for char in line:
            if char in '{[(':
                stack.append((char, line_num))
            elif char in '}])':
                if not stack:
                    print(f"[{line_num}] Extra closing: {char}")
                    continue
                last_char, last_line = stack.pop()
                if (char == '}' and last_char != '{') or \
                   (char == ']' and last_char != '[') or \
                   (char == ')' and last_char != '('):
                    print(f"[{line_num}] Mismatched: expected closing for {last_char} (from line {last_line}), but found {char}")

    while stack:
        char, line = stack.pop()
        print(f"UNCLOSED: {char} from line {line}")

if __name__ == "__main__":
    check_braces('src/pages/MarketDetail.tsx')
