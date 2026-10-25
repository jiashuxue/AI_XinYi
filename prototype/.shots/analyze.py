"""最小 PNG 解码器：统计主色 + ASCII 亮度缩略图，用于原型视觉自检。"""
import sys, struct, zlib

def decode_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    pos = 8
    def chunk():
        nonlocal pos
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        body = data[pos+8:pos+8+ln]
        pos += 12 + ln
        return typ, body
    typ, ihdr = chunk()
    w, h, bd, ct, comp, filt, inter = struct.unpack('>IIBBBBB', ihdr)
    assert bd == 8, 'only 8-bit depth supported'
    assert ct in (2, 6), 'only RGB/RGBA supported'
    bpp = 3 if ct == 2 else 4
    stride = w * bpp
    idat = b''
    while True:
        typ, body = chunk()
        if typ == b'IDAT': idat += body
        if typ == b'IEND': break
    raw = zlib.decompress(idat)
    # 还原 filter
    rows = []
    prev = bytearray(stride)
    i = 0
    for y in range(h):
        ft = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        if ft == 1:   # Sub
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x-bpp]) & 255
        elif ft == 2: # Up
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif ft == 3: # Average
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                line[x] = (line[x] + (a + prev[x]) // 2) & 255
        elif ft == 4: # Paeth
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append(line)
        prev = line
    # 像素
    pix = []
    for y in range(h):
        row = rows[y]
        for x in range(w):
            o = x * bpp
            pix.append((row[o], row[o+1], row[o+2]))  # RGB
    return w, h, pix

def main():
    w, h, pix = decode_png(sys.argv[1])
    print(f'尺寸: {w}x{h}')
    # 主色统计（量化到 16 级）
    from collections import Counter
    cnt = Counter()
    for p in pix:
        q = tuple(v // 16 * 16 for v in p)
        cnt[q] += 1
    tot = len(pix)
    print('主要颜色:')
    for c, n in sorted(cnt.items(), key=lambda x: -x[1])[:10]:
        r, g, b = c
        print(f'  #{r:02X}{g:02X}{b:02X}  {100*n/tot:.1f}%')
    # ASCII 亮度图（60 列）
    cols = 60
    rows = max(1, int(h * cols / w / 2.1))  # 字符高宽比补偿
    cell_w = w / cols
    cell_h = h / rows
    ramp = ' .:-=+*#%@'
    print('=====LAYOUT=====')
    for ry in range(rows):
        line = ''
        for rx in range(cols):
            # 采样区块平均亮度
            lum = 0; n = 0
            x0 = int(rx * cell_w); x1 = min(w, int((rx+1)*cell_w))
            y0 = int(ry * cell_h); y1 = min(h, int((ry+1)*cell_h))
            for y in range(y0, y1, max(1, int(cell_h/4))):
                for x in range(x0, x1, max(1, int(cell_w/4))):
                    idx = y*w + x
                    if idx < len(pix):
                        r, g, b = pix[idx]
                        lum += 0.299*r + 0.587*g + 0.114*b
                        n += 1
            if n:
                lum /= n
                # 纸色偏亮为底色，字符反向：暗处用'@'，亮处用' '
                line += ramp[min(9, int((255-lum)/25.5))]
            else:
                line += ' '
        print(line)

if __name__ == '__main__':
    main()
