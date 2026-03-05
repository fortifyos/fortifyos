import sys
B = chr(96)
D = chr(36)
raw = """
        {/* ── LORDS OF EASY MONEY — Daily Quote ── */}
short test line
test XBTX1px solid XDSX{t.borderMid}XBTX
test with single quotes: 'hello' and XBTX
test {{ double braces }}
test {{ double braces }} and XDSX{t.borderMid}
test {{ marginTop: 12, border: XBTX1px solid XDSX{t.borderMid}XBTX }}
test with 'single' quotes and double double {{ braces }}
test {{ aa: 'bb', cc: 'dd' }}
test {{ border: XBTX1px solidXBTX, padding: '14px' }}
test {{ border: XBTX1px solid XDSX{t}XBTX, padding: '14px' }}
test {{ border: XBTX1px solid XDSX{t.borderMid}XBTX, background: t.panel, padding: '14px' }}
test {{ border: XBTX1px solid XDSX{t.borderMid}XBTX, background: t.panel, padding: '14px 16px' }}
test {{ border: XBTX1px solid XDSX{t.borderMid}XBTX, background: t.panel, padding: '14px 16px', animation: 'radarFadeUp 0.3s ease-out 0.3s both' }}
test XBTX1px solid XDSX{t.borderMid}XBTX
XBTX1px solid XDSX{t.borderMid}XBTX
Xdiv XBTX1px solid XDSX{t.borderMid}XBTX
test +hello
