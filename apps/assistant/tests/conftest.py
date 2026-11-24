import pytest

from app import budget


@pytest.fixture(autouse=True)
def _no_leftover_clock():
    # ask() starts a time budget (app/budget.py). Clear it around every test so
    # a clock from one test can never make a call in the next one time out.
    budget.reset()
    yield
    budget.reset()
