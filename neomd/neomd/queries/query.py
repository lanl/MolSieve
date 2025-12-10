from typing import List


class Query:
    text: str
    options: List[str]

    def __init__(self, text, options):
        self.text = text
        self.options = options
