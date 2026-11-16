FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ARG ENABLE_TRADINGAGENTS=false
RUN if [ "$ENABLE_TRADINGAGENTS" = "true" ]; then pip install --no-cache-dir ./upstream/tradingagents; fi
RUN useradd --uid 10001 --create-home research && mkdir -p /data && chown research /data
USER research
EXPOSE 8010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "1"]
