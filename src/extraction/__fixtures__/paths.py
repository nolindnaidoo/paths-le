"""What the generic scan claims in a source file. See docs/scan.md."""

import os.path
import numpy as np
from app.models import User

BASE = os.path.join("/var/data", "cache")
CONFIG = open("./config/app.yaml")
LOG_DIR = "/var/log/service"
WINDOWS = "C:\\Temp\\out"

# See docs/architecture.md for the layout, and don't forget ./setup.sh.
# A version like 1.8.1 and an address like 192.168.1.1 are not paths.
# A glob such as src/**/*.py is rejected whole, not split into pieces.


def load(name):
    np.array([1, 2])
    here = os.path.dirname(__file__)
    return open(os.path.join(here, "reports/summary.json"))
