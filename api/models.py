from pydantic import BaseModel
from typing import Optional

class AnalysisStep(BaseModel):
    analysisType: str
    value: str

class AnalysisRequest(BaseModel):
    pathStart: Optional[str] = None
    pathEnd: Optional[str] = None
