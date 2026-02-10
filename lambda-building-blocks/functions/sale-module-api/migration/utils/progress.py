"""
Progress tracking utilities for migration
"""

from tqdm import tqdm
from colorama import Fore, Style, init

# Initialize colorama
init(autoreset=True)


class ProgressTracker:
    """Track and display migration progress"""

    def __init__(self):
        self.bars = {}
        self.stats = {}

    def create_bar(self, name, total, desc=None):
        """Create a new progress bar"""
        bar = tqdm(
            total=total,
            desc=desc or name,
            bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]',
            colour='green'
        )
        self.bars[name] = bar
        self.stats[name] = {'total': total, 'processed': 0, 'errors': 0}
        return bar

    def update(self, name, amount=1):
        """Update progress bar"""
        if name in self.bars:
            self.bars[name].update(amount)
            self.stats[name]['processed'] += amount

    def error(self, name):
        """Record an error"""
        if name in self.stats:
            self.stats[name]['errors'] += 1

    def close(self, name):
        """Close a progress bar"""
        if name in self.bars:
            self.bars[name].close()

    def close_all(self):
        """Close all progress bars"""
        for bar in self.bars.values():
            bar.close()

    def get_stats(self, name):
        """Get statistics for a progress bar"""
        return self.stats.get(name, {})

    def print_summary(self):
        """Print summary of all progress"""
        print(f"\n{Fore.CYAN}{'=' * 60}")
        print(f"{Fore.CYAN}Migration Progress Summary")
        print(f"{Fore.CYAN}{'=' * 60}{Style.RESET_ALL}\n")

        for name, stats in self.stats.items():
            total = stats.get('total', 0)
            processed = stats.get('processed', 0)
            errors = stats.get('errors', 0)

            pct = (processed / total * 100) if total > 0 else 0

            color = Fore.GREEN if errors == 0 else Fore.YELLOW

            print(f"{color}{name.capitalize():15} {processed:>6}/{total:<6} "
                  f"({pct:>5.1f}%) - Errors: {errors}{Style.RESET_ALL}")

        print(f"\n{Fore.CYAN}{'=' * 60}{Style.RESET_ALL}\n")
