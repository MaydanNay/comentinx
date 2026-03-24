npm run dev -- -p 3001


docker compose down
docker compose up --build -d
docker compose logs -f

git add .
git commit -m "."
git push -f origin main