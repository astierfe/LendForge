import sys
from pathlib import Path

bot_root = Path(__file__).parent.parent
src_path = bot_root / "src"

sys.path.insert(0, str(src_path))
sys.path.insert(0, str(bot_root))
