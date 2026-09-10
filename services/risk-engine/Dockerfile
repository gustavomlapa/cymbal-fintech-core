FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PORT=8085

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt || true

COPY . .

EXPOSE 8085

CMD ["python", "main.py"]

