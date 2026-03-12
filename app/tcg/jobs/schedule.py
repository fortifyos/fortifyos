from __future__ import annotations

from apscheduler.schedulers.blocking import BlockingScheduler

from app.tcg.jobs.run_cycle import run_tcg_cycle


def main() -> None:
    scheduler = BlockingScheduler(timezone="America/New_York")
    for hour in [0, 3, 6, 9, 12, 15, 18, 21]:
        scheduler.add_job(lambda: run_tcg_cycle(), "cron", hour=hour, minute=0)
    print("FORTIFY OS TCG RADAR scheduler started for 3-hour cycles.")
    scheduler.start()


if __name__ == "__main__":
    main()
